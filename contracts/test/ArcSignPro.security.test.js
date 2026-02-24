const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArcSignPro Security", function () {
  let arcSignPro;
  let mockUSDT;
  let owner;
  let treasury;
  let user1;
  let user2;
  let attacker;

  const PRICE = ethers.parseEther("30");
  const DURATION = 365 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, treasury, user1, user2, attacker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 18);

    const ArcSignPro = await ethers.getContractFactory("ArcSignPro");
    arcSignPro = await ArcSignPro.deploy(await mockUSDT.getAddress(), treasury.address);

    // Fund users
    await mockUSDT.mint(user1.address, ethers.parseEther("1000"));
    await mockUSDT.mint(user2.address, ethers.parseEther("1000"));
    await mockUSDT.mint(attacker.address, ethers.parseEther("1000"));
  });

  describe("Zero Address Checks", function () {
    it("Should reject zero address USDT in constructor", async function () {
      const ArcSignPro = await ethers.getContractFactory("ArcSignPro");
      await expect(ArcSignPro.deploy(ethers.ZeroAddress, treasury.address))
        .to.be.revertedWith("Invalid payment token");
    });

    it("Should reject zero address treasury in constructor", async function () {
      const ArcSignPro = await ethers.getContractFactory("ArcSignPro");
      await expect(ArcSignPro.deploy(await mockUSDT.getAddress(), ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury");
    });
  });

  describe("Same User Multiple Mints", function () {
    it("Should allow same user to mint multiple NFTs", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 3n);

      await arcSignPro.connect(user1).mint();
      await arcSignPro.connect(user1).mint();
      await arcSignPro.connect(user1).mint();

      expect(await arcSignPro.balanceOf(user1.address)).to.equal(3);
    });

    it("Should assign sequential token IDs", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 2n);

      await arcSignPro.connect(user1).mint();
      await arcSignPro.connect(user1).mint();

      expect(await arcSignPro.ownerOf(1)).to.equal(user1.address);
      expect(await arcSignPro.ownerOf(2)).to.equal(user1.address);
    });
  });

  describe("Token ID Integrity", function () {
    it("Should start token IDs from 1", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      expect(await arcSignPro.ownerOf(1)).to.equal(user1.address);
    });

    it("Should not allow querying non-existent token", async function () {
      await expect(arcSignPro.timeUntilExpiry(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("ERC721 Compliance", function () {
    it("Should support ERC721 interface", async function () {
      // ERC721 interface ID: 0x80ac58cd
      expect(await arcSignPro.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should support ERC721Enumerable interface", async function () {
      // ERC721Enumerable interface ID: 0x780e9d63
      expect(await arcSignPro.supportsInterface("0x780e9d63")).to.be.true;
    });

    it("Should support ERC165 interface", async function () {
      // ERC165 interface ID: 0x01ffc9a7
      expect(await arcSignPro.supportsInterface("0x01ffc9a7")).to.be.true;
    });
  });

  describe("Gas Usage", function () {
    it("Mint should use reasonable gas", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      const tx = await arcSignPro.connect(user1).mint();
      const receipt = await tx.wait();

      // Gas should be under 300k for a mint operation
      expect(receipt.gasUsed).to.be.lt(300000);
    });

    it("Renew should use reasonable gas", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 2n);
      await arcSignPro.connect(user1).mint();

      const tx = await arcSignPro.connect(user1).renew(1);
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(200000);
    });
  });

  describe("Access Control", function () {
    it("Should reject non-owner setTreasury", async function () {
      await expect(arcSignPro.connect(attacker).setTreasury(attacker.address))
        .to.be.reverted;
    });

    it("Should reject non-owner setBaseURI", async function () {
      await expect(arcSignPro.connect(attacker).setBaseURI("https://evil.com/"))
        .to.be.reverted;
    });

    it("Should reject non-owner ERC20 withdraw", async function () {
      await expect(
        arcSignPro.connect(attacker).withdraw(
          await mockUSDT.getAddress(),
          attacker.address,
          ethers.parseEther("1")
        )
      ).to.be.reverted;
    });

    it("Should reject non-owner BNB withdraw", async function () {
      await expect(
        arcSignPro.connect(attacker).withdraw(
          ethers.ZeroAddress,
          attacker.address,
          ethers.parseEther("1")
        )
      ).to.be.reverted;
    });
  });

  describe("Device Binding Security", function () {
    it("Should not allow non-owner to bind device", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      const deviceHash = ethers.keccak256(ethers.toUtf8Bytes("attacker-device"));
      await expect(arcSignPro.connect(attacker).bindDevice(1, deviceHash))
        .to.be.revertedWith("Not owner");
    });

    it("Should not expose device hash to non-owners", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      const deviceHash = ethers.keccak256(ethers.toUtf8Bytes("secret-device"));
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);

      // verifyDevice is public but only confirms/denies - doesn't reveal the hash
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("guess"));
      expect(await arcSignPro.verifyDevice(1, wrongHash)).to.be.false;
    });
  });

  describe("Receive BNB", function () {
    it("Should accept direct BNB transfers", async function () {
      await expect(
        owner.sendTransaction({
          to: await arcSignPro.getAddress(),
          value: ethers.parseEther("0.01"),
        })
      ).to.not.be.reverted;
    });
  });
});
