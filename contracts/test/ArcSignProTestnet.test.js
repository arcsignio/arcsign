const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArcSignProTestnet", function () {
  let arcSignProTestnet;
  let owner;
  let treasury;
  let user1;
  let user2;

  const PRICE = ethers.parseEther("0.001"); // 0.001 tBNB
  const DURATION = 365 * 24 * 60 * 60; // 1 year in seconds

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    const ArcSignProTestnet = await ethers.getContractFactory("ArcSignProTestnet");
    arcSignProTestnet = await ArcSignProTestnet.deploy(treasury.address);
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await arcSignProTestnet.name()).to.equal("ArcSign Pro Testnet");
      expect(await arcSignProTestnet.symbol()).to.equal("ARCPRO-TEST");
    });

    it("Should set the correct treasury", async function () {
      expect(await arcSignProTestnet.treasury()).to.equal(treasury.address);
    });

    it("Should set the correct price", async function () {
      expect(await arcSignProTestnet.PRICE()).to.equal(PRICE);
    });

    it("Should set the correct duration", async function () {
      expect(await arcSignProTestnet.DURATION()).to.equal(DURATION);
    });

    it("Should reject zero address treasury", async function () {
      const ArcSignProTestnet = await ethers.getContractFactory("ArcSignProTestnet");
      await expect(ArcSignProTestnet.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury");
    });
  });

  describe("Minting with BNB", function () {
    it("Should mint a membership NFT with BNB", async function () {
      await expect(arcSignProTestnet.connect(user1).mint({ value: PRICE }))
        .to.emit(arcSignProTestnet, "MembershipMinted");

      expect(await arcSignProTestnet.balanceOf(user1.address)).to.equal(1);
      expect(await arcSignProTestnet.ownerOf(1)).to.equal(user1.address);
    });

    it("Should set correct expiration on mint", async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });

      const expiry = await arcSignProTestnet.expiresAt(1);
      const blockTime = await time.latest();

      expect(expiry).to.be.closeTo(blockTime + DURATION, 5);
    });

    it("Should transfer BNB to treasury", async function () {
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(PRICE);
    });

    it("Should reject insufficient BNB payment", async function () {
      const insufficientAmount = ethers.parseEther("0.0001");
      await expect(arcSignProTestnet.connect(user1).mint({ value: insufficientAmount }))
        .to.be.revertedWith("Insufficient payment");
    });

    it("Should accept overpayment", async function () {
      const overpayment = ethers.parseEther("0.01");
      await expect(arcSignProTestnet.connect(user1).mint({ value: overpayment }))
        .to.not.be.reverted;

      expect(await arcSignProTestnet.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Renewal", function () {
    beforeEach(async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });
    });

    it("Should extend expiration for active membership", async function () {
      const expiryBefore = await arcSignProTestnet.expiresAt(1);
      await arcSignProTestnet.connect(user1).renew(1, { value: PRICE });
      const expiryAfter = await arcSignProTestnet.expiresAt(1);

      expect(expiryAfter - expiryBefore).to.equal(DURATION);
    });

    it("Should renew expired membership from current time", async function () {
      await time.increase(DURATION + 86400);

      await arcSignProTestnet.connect(user1).renew(1, { value: PRICE });

      const expiry = await arcSignProTestnet.expiresAt(1);
      const blockTime = await time.latest();

      expect(expiry).to.be.closeTo(blockTime + DURATION, 5);
    });

    it("Should allow gift renewal from another user", async function () {
      const expiryBefore = await arcSignProTestnet.expiresAt(1);
      await arcSignProTestnet.connect(user2).renew(1, { value: PRICE });
      const expiryAfter = await arcSignProTestnet.expiresAt(1);

      expect(expiryAfter - expiryBefore).to.equal(DURATION);
    });

    it("Should reject renewal with insufficient payment", async function () {
      await expect(
        arcSignProTestnet.connect(user1).renew(1, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should reject renewal of non-existent token", async function () {
      await expect(
        arcSignProTestnet.connect(user1).renew(999, { value: PRICE })
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should emit MembershipRenewed event", async function () {
      await expect(arcSignProTestnet.connect(user1).renew(1, { value: PRICE }))
        .to.emit(arcSignProTestnet, "MembershipRenewed");
    });
  });

  describe("Validity Check", function () {
    beforeEach(async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });
    });

    it("Should return true for valid member", async function () {
      expect(await arcSignProTestnet.isValidMember(user1.address)).to.be.true;
    });

    it("Should return false for non-member", async function () {
      expect(await arcSignProTestnet.isValidMember(user2.address)).to.be.false;
    });

    it("Should return false after expiration", async function () {
      await time.increase(DURATION + 86400);
      expect(await arcSignProTestnet.isValidMember(user1.address)).to.be.false;
    });

    it("Should return correct time until expiry", async function () {
      const timeLeft = await arcSignProTestnet.timeUntilExpiry(1);
      expect(timeLeft).to.be.closeTo(DURATION, 5);
    });

    it("Should return 0 time for expired token", async function () {
      await time.increase(DURATION + 86400);
      expect(await arcSignProTestnet.timeUntilExpiry(1)).to.equal(0);
    });
  });

  describe("getMemberships", function () {
    it("Should return correct data for single membership", async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });

      const [tokenIds, expirations, valid] = await arcSignProTestnet.getMemberships(user1.address);

      expect(tokenIds.length).to.equal(1);
      expect(tokenIds[0]).to.equal(1);
      expect(expirations[0]).to.be.gt(0);
      expect(valid[0]).to.be.true;
    });

    it("Should return multiple memberships", async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });

      const [tokenIds] = await arcSignProTestnet.getMemberships(user1.address);
      expect(tokenIds.length).to.equal(2);
    });

    it("Should return empty for non-holder", async function () {
      const [tokenIds] = await arcSignProTestnet.getMemberships(user2.address);
      expect(tokenIds.length).to.equal(0);
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      await arcSignProTestnet.connect(user1).mint({ value: PRICE });
    });

    it("Should allow transfer and preserve expiration", async function () {
      const expiryBefore = await arcSignProTestnet.expiresAt(1);

      await arcSignProTestnet.connect(user1).transferFrom(user1.address, user2.address, 1);

      expect(await arcSignProTestnet.ownerOf(1)).to.equal(user2.address);
      expect(await arcSignProTestnet.expiresAt(1)).to.equal(expiryBefore);
    });

    it("Should update membership status after transfer", async function () {
      await arcSignProTestnet.connect(user1).transferFrom(user1.address, user2.address, 1);

      expect(await arcSignProTestnet.isValidMember(user1.address)).to.be.false;
      expect(await arcSignProTestnet.isValidMember(user2.address)).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update treasury", async function () {
      await expect(arcSignProTestnet.setTreasury(user1.address))
        .to.emit(arcSignProTestnet, "TreasuryUpdated")
        .withArgs(treasury.address, user1.address);

      expect(await arcSignProTestnet.treasury()).to.equal(user1.address);
    });

    it("Should reject non-owner treasury update", async function () {
      await expect(arcSignProTestnet.connect(user1).setTreasury(user1.address))
        .to.be.reverted;
    });

    it("Should reject zero address treasury", async function () {
      await expect(arcSignProTestnet.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury");
    });

    it("Should allow owner to set base URI", async function () {
      await expect(arcSignProTestnet.setBaseURI("https://test.arcsign.io/nft/"))
        .to.emit(arcSignProTestnet, "BaseURIUpdated")
        .withArgs("https://test.arcsign.io/nft/");
    });

    it("Should allow owner to withdraw BNB", async function () {
      // Send BNB to contract via receive()
      await owner.sendTransaction({
        to: await arcSignProTestnet.getAddress(),
        value: ethers.parseEther("0.5"),
      });

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await arcSignProTestnet.withdraw(user1.address, ethers.parseEther("0.5"));
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.5"));
    });

    it("Should reject non-owner withdraw", async function () {
      await expect(
        arcSignProTestnet.connect(user1).withdraw(user1.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });

    it("Should reject withdraw to zero address", async function () {
      await expect(
        arcSignProTestnet.withdraw(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should emit Withdrawn event", async function () {
      await owner.sendTransaction({
        to: await arcSignProTestnet.getAddress(),
        value: ethers.parseEther("0.1"),
      });

      await expect(arcSignProTestnet.withdraw(user1.address, ethers.parseEther("0.1")))
        .to.emit(arcSignProTestnet, "Withdrawn")
        .withArgs(user1.address, ethers.parseEther("0.1"));
    });
  });

  describe("Receive BNB", function () {
    it("Should accept direct BNB transfers", async function () {
      await expect(
        owner.sendTransaction({
          to: await arcSignProTestnet.getAddress(),
          value: ethers.parseEther("0.01"),
        })
      ).to.not.be.reverted;
    });
  });
});
