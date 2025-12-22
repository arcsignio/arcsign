const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArcSignPro", function () {
  let arcSignPro;
  let mockUSDT;
  let owner;
  let treasury;
  let user1;
  let user2;

  const PRICE = ethers.parseEther("30"); // 30 USDT
  const DURATION = 365 * 24 * 60 * 60; // 1 year in seconds

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    // Deploy mock USDT
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 18);

    // Deploy ArcSignPro
    const ArcSignPro = await ethers.getContractFactory("ArcSignPro");
    arcSignPro = await ArcSignPro.deploy(await mockUSDT.getAddress(), treasury.address);

    // Mint USDT to users
    await mockUSDT.mint(user1.address, ethers.parseEther("1000"));
    await mockUSDT.mint(user2.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await arcSignPro.name()).to.equal("ArcSign Pro");
      expect(await arcSignPro.symbol()).to.equal("ARCPRO");
    });

    it("Should set the correct treasury", async function () {
      expect(await arcSignPro.treasury()).to.equal(treasury.address);
    });

    it("Should set the correct price", async function () {
      expect(await arcSignPro.PRICE()).to.equal(PRICE);
    });

    it("Should set the correct duration", async function () {
      expect(await arcSignPro.DURATION()).to.equal(DURATION);
    });
  });

  describe("Minting", function () {
    it("Should mint a membership NFT", async function () {
      // Approve USDT
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);

      // Mint
      await expect(arcSignPro.connect(user1).mint())
        .to.emit(arcSignPro, "MembershipMinted");

      // Check ownership
      expect(await arcSignPro.balanceOf(user1.address)).to.equal(1);
      expect(await arcSignPro.ownerOf(1)).to.equal(user1.address);
    });

    it("Should set correct expiration", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      const expiry = await arcSignPro.expiresAt(1);
      const blockTime = await time.latest();

      expect(expiry).to.be.closeTo(blockTime + DURATION, 5);
    });

    it("Should transfer payment to treasury", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);

      const treasuryBalanceBefore = await mockUSDT.balanceOf(treasury.address);
      await arcSignPro.connect(user1).mint();
      const treasuryBalanceAfter = await mockUSDT.balanceOf(treasury.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(PRICE);
    });

    it("Should fail without approval", async function () {
      await expect(arcSignPro.connect(user1).mint())
        .to.be.reverted;
    });
  });

  describe("Validity Check", function () {
    beforeEach(async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();
    });

    it("Should return true for valid membership", async function () {
      expect(await arcSignPro.isValidMember(user1.address)).to.be.true;
    });

    it("Should return false for non-member", async function () {
      expect(await arcSignPro.isValidMember(user2.address)).to.be.false;
    });

    it("Should return false after expiration", async function () {
      // Fast forward 1 year + 1 day
      await time.increase(DURATION + 86400);

      expect(await arcSignPro.isValidMember(user1.address)).to.be.false;
    });

    it("Should return correct time until expiry", async function () {
      const timeLeft = await arcSignPro.timeUntilExpiry(1);
      expect(timeLeft).to.be.closeTo(DURATION, 5);
    });

    it("Should return 0 after expiration", async function () {
      await time.increase(DURATION + 86400);
      expect(await arcSignPro.timeUntilExpiry(1)).to.equal(0);
    });
  });

  describe("Renewal", function () {
    beforeEach(async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 3n);
      await arcSignPro.connect(user1).mint();
    });

    it("Should extend expiration when renewing active membership", async function () {
      const expiryBefore = await arcSignPro.expiresAt(1);

      await arcSignPro.connect(user1).renew(1);

      const expiryAfter = await arcSignPro.expiresAt(1);
      expect(expiryAfter - expiryBefore).to.equal(DURATION);
    });

    it("Should renew from current time when expired", async function () {
      // Fast forward past expiration
      await time.increase(DURATION + 86400);

      await arcSignPro.connect(user1).renew(1);

      const expiry = await arcSignPro.expiresAt(1);
      const blockTime = await time.latest();

      expect(expiry).to.be.closeTo(blockTime + DURATION, 5);
    });

    it("Should allow anyone to gift renewal", async function () {
      await mockUSDT.connect(user2).approve(await arcSignPro.getAddress(), PRICE);

      const expiryBefore = await arcSignPro.expiresAt(1);
      await arcSignPro.connect(user2).renew(1);
      const expiryAfter = await arcSignPro.expiresAt(1);

      expect(expiryAfter - expiryBefore).to.equal(DURATION);
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();
    });

    it("Should allow transfer", async function () {
      await arcSignPro.connect(user1).transferFrom(user1.address, user2.address, 1);

      expect(await arcSignPro.ownerOf(1)).to.equal(user2.address);
      expect(await arcSignPro.isValidMember(user1.address)).to.be.false;
      expect(await arcSignPro.isValidMember(user2.address)).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update treasury", async function () {
      await arcSignPro.setTreasury(user1.address);
      expect(await arcSignPro.treasury()).to.equal(user1.address);
    });

    it("Should not allow non-owner to update treasury", async function () {
      await expect(arcSignPro.connect(user1).setTreasury(user1.address))
        .to.be.reverted;
    });

    it("Should allow owner to set base URI", async function () {
      await arcSignPro.setBaseURI("https://api.arcsign.io/nft/");
      // Token URI would be baseURI + tokenId
    });
  });
});

// Mock ERC20 for testing
const MockERC20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
`;
