const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArcSignReferral", function () {
  let referral;
  let owner;
  let user1;
  let user2;
  let user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const ArcSignReferral = await ethers.getContractFactory("ArcSignReferral");
    referral = await ArcSignReferral.deploy();
  });

  describe("Deployment", function () {
    it("Should set deployer as owner", async function () {
      expect(await referral.owner()).to.equal(owner.address);
    });

    it("Should start nextCode at 1", async function () {
      expect(await referral.nextCode()).to.equal(1);
    });
  });

  describe("registerCode", function () {
    it("Should register a code and return 1 for first user", async function () {
      await expect(referral.connect(user1).registerCode())
        .to.emit(referral, "CodeRegistered")
        .withArgs(user1.address, 1);

      expect(await referral.addressToCode(user1.address)).to.equal(1);
      expect(await referral.codeToAddress(1)).to.equal(user1.address);
      expect(await referral.nextCode()).to.equal(2);
    });

    it("Should auto-increment codes", async function () {
      await referral.connect(user1).registerCode();
      await referral.connect(user2).registerCode();

      expect(await referral.addressToCode(user1.address)).to.equal(1);
      expect(await referral.addressToCode(user2.address)).to.equal(2);
      expect(await referral.nextCode()).to.equal(3);
    });

    it("Should revert if already registered", async function () {
      await referral.connect(user1).registerCode();

      await expect(referral.connect(user1).registerCode())
        .to.be.revertedWith("Already registered");
    });
  });

  describe("setReferrer", function () {
    beforeEach(async function () {
      // user1 registers code 1
      await referral.connect(user1).registerCode();
    });

    it("Should set referrer successfully", async function () {
      await expect(referral.connect(user2).setReferrer(1))
        .to.emit(referral, "ReferrerSet")
        .withArgs(user2.address, user1.address, 1);

      expect(await referral.referrerOf(user2.address)).to.equal(user1.address);
      expect(await referral.hasReferrer(user2.address)).to.equal(true);
      expect(await referral.referralCount(user1.address)).to.equal(1);
    });

    it("Should increment referral count for multiple referrals", async function () {
      await referral.connect(user2).setReferrer(1);
      await referral.connect(user3).setReferrer(1);

      expect(await referral.referralCount(user1.address)).to.equal(2);
    });

    it("Should revert if referrer already set", async function () {
      await referral.connect(user2).setReferrer(1);

      // user1 also registers a code (code 2 now exists)
      // but user2 cannot change referrer
      await expect(referral.connect(user2).setReferrer(1))
        .to.be.revertedWith("Already set");
    });

    it("Should revert on invalid code (0)", async function () {
      await expect(referral.connect(user2).setReferrer(0))
        .to.be.revertedWith("Invalid code");
    });

    it("Should revert on non-existent code", async function () {
      await expect(referral.connect(user2).setReferrer(999))
        .to.be.revertedWith("Invalid code");
    });

    it("Should revert on self referral", async function () {
      await expect(referral.connect(user1).setReferrer(1))
        .to.be.revertedWith("Self referral");
    });
  });

  describe("View functions", function () {
    beforeEach(async function () {
      await referral.connect(user1).registerCode(); // code 1
      await referral.connect(user2).setReferrer(1);
    });

    it("getCode should return code for registered user", async function () {
      expect(await referral.getCode(user1.address)).to.equal(1);
    });

    it("getCode should return 0 for unregistered user", async function () {
      expect(await referral.getCode(user3.address)).to.equal(0);
    });

    it("getReferrer should return referrer info", async function () {
      const [addr, code] = await referral.getReferrer(user2.address);
      expect(addr).to.equal(user1.address);
      expect(code).to.equal(1);
    });

    it("getReferrer should return zero for user without referrer", async function () {
      const [addr, code] = await referral.getReferrer(user3.address);
      expect(addr).to.equal(ethers.ZeroAddress);
      expect(code).to.equal(0);
    });

    it("getReferralCount should return correct count", async function () {
      expect(await referral.getReferralCount(user1.address)).to.equal(1);
    });

    it("resolveCode should return address for valid code", async function () {
      expect(await referral.resolveCode(1)).to.equal(user1.address);
    });

    it("resolveCode should return zero address for invalid code", async function () {
      expect(await referral.resolveCode(999)).to.equal(ethers.ZeroAddress);
    });
  });
});
