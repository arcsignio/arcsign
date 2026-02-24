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

    it("Should emit TreasuryUpdated event with correct addresses", async function () {
      await expect(arcSignPro.setTreasury(user1.address))
        .to.emit(arcSignPro, "TreasuryUpdated")
        .withArgs(treasury.address, user1.address);
    });

    it("Should reject zero address for treasury", async function () {
      await expect(arcSignPro.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury");
    });

    it("Should emit BaseURIUpdated event", async function () {
      await expect(arcSignPro.setBaseURI("https://api.arcsign.io/nft/"))
        .to.emit(arcSignPro, "BaseURIUpdated")
        .withArgs("https://api.arcsign.io/nft/");
    });
  });

  describe("Device Binding", function () {
    const deviceHash = ethers.keccak256(ethers.toUtf8Bytes("usb-device-001"));

    beforeEach(async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();
    });

    it("Should bind device to owned token", async function () {
      await expect(arcSignPro.connect(user1).bindDevice(1, deviceHash))
        .to.emit(arcSignPro, "DeviceBound")
        .withArgs(1, deviceHash, user1.address);
    });

    it("Should reject binding from non-owner", async function () {
      await expect(arcSignPro.connect(user2).bindDevice(1, deviceHash))
        .to.be.revertedWith("Not owner");
    });

    it("Should reject binding already-bound token", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);

      const anotherHash = ethers.keccak256(ethers.toUtf8Bytes("usb-device-002"));
      await expect(arcSignPro.connect(user1).bindDevice(1, anotherHash))
        .to.be.revertedWith("Already bound");
    });

    it("Should reject zero device hash", async function () {
      await expect(arcSignPro.connect(user1).bindDevice(1, ethers.ZeroHash))
        .to.be.revertedWith("Invalid device hash");
    });

    it("Should verify correct device hash", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);
      expect(await arcSignPro.verifyDevice(1, deviceHash)).to.be.true;
    });

    it("Should reject incorrect device hash", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong-device"));
      expect(await arcSignPro.verifyDevice(1, wrongHash)).to.be.false;
    });

    it("Should return isBound true after binding", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);
      expect(await arcSignPro.isBound(1)).to.be.true;
    });

    it("Should return isBound false before binding", async function () {
      expect(await arcSignPro.isBound(1)).to.be.false;
    });

    it("Should clear binding on transfer and emit DeviceUnbound", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);
      expect(await arcSignPro.isBound(1)).to.be.true;

      await expect(arcSignPro.connect(user1).transferFrom(user1.address, user2.address, 1))
        .to.emit(arcSignPro, "DeviceUnbound")
        .withArgs(1);

      expect(await arcSignPro.isBound(1)).to.be.false;
      expect(await arcSignPro.deviceBindings(1)).to.equal(ethers.ZeroHash);
    });

    it("Should allow new owner to rebind after transfer", async function () {
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);
      await arcSignPro.connect(user1).transferFrom(user1.address, user2.address, 1);

      const newDeviceHash = ethers.keccak256(ethers.toUtf8Bytes("new-usb-device"));
      await expect(arcSignPro.connect(user2).bindDevice(1, newDeviceHash))
        .to.emit(arcSignPro, "DeviceBound")
        .withArgs(1, newDeviceHash, user2.address);

      expect(await arcSignPro.verifyDevice(1, newDeviceHash)).to.be.true;
    });
  });

  describe("getMemberships", function () {
    it("Should return correct data for single NFT", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      const [tokenIds, expirations, valid] = await arcSignPro.getMemberships(user1.address);

      expect(tokenIds.length).to.equal(1);
      expect(tokenIds[0]).to.equal(1);
      expect(expirations[0]).to.be.gt(0);
      expect(valid[0]).to.be.true;
    });

    it("Should return correct data for multiple NFTs", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 3n);
      await arcSignPro.connect(user1).mint();
      await arcSignPro.connect(user1).mint();
      await arcSignPro.connect(user1).mint();

      const [tokenIds, expirations, valid] = await arcSignPro.getMemberships(user1.address);

      expect(tokenIds.length).to.equal(3);
      expect(valid[0]).to.be.true;
      expect(valid[1]).to.be.true;
      expect(valid[2]).to.be.true;
    });

    it("Should return empty for non-holder", async function () {
      const [tokenIds] = await arcSignPro.getMemberships(user2.address);
      expect(tokenIds.length).to.equal(0);
    });

    it("Should mark expired NFTs correctly", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      await time.increase(DURATION + 86400);

      const [, , valid] = await arcSignPro.getMemberships(user1.address);
      expect(valid[0]).to.be.false;
    });
  });

  describe("getDeviceBindings", function () {
    it("Should return correct binding data", async function () {
      const deviceHash = ethers.keccak256(ethers.toUtf8Bytes("test-device"));

      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 2n);
      await arcSignPro.connect(user1).mint(); // token 1
      await arcSignPro.connect(user1).mint(); // token 2

      // Bind only token 1
      await arcSignPro.connect(user1).bindDevice(1, deviceHash);

      const [tokenIds, bindings, bound] = await arcSignPro.getDeviceBindings(user1.address);

      expect(tokenIds.length).to.equal(2);
      expect(bound[0]).to.be.true;  // token 1 bound
      expect(bound[1]).to.be.false; // token 2 unbound
      expect(bindings[0]).to.equal(deviceHash);
      expect(bindings[1]).to.equal(ethers.ZeroHash);
    });
  });

  describe("Withdraw", function () {
    it("Should allow owner to withdraw ERC20", async function () {
      // Send some USDT to the contract accidentally
      await mockUSDT.mint(await arcSignPro.getAddress(), ethers.parseEther("50"));

      const balanceBefore = await mockUSDT.balanceOf(owner.address);
      await arcSignPro.withdraw(await mockUSDT.getAddress(), owner.address, ethers.parseEther("50"));
      const balanceAfter = await mockUSDT.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("50"));
    });

    it("Should allow owner to withdraw BNB", async function () {
      // Send BNB to contract
      await owner.sendTransaction({
        to: await arcSignPro.getAddress(),
        value: ethers.parseEther("1"),
      });

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await arcSignPro.withdraw(ethers.ZeroAddress, user1.address, ethers.parseEther("1"));
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
    });

    it("Should reject withdraw by non-owner", async function () {
      await expect(
        arcSignPro.connect(user1).withdraw(ethers.ZeroAddress, user1.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });

    it("Should reject withdraw to zero address", async function () {
      await expect(
        arcSignPro.withdraw(ethers.ZeroAddress, ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple consecutive renewals", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 4n);
      await arcSignPro.connect(user1).mint();

      const expiryAfterMint = await arcSignPro.expiresAt(1);

      await arcSignPro.connect(user1).renew(1);
      await arcSignPro.connect(user1).renew(1);

      const expiryAfterTwoRenewals = await arcSignPro.expiresAt(1);
      expect(expiryAfterTwoRenewals - expiryAfterMint).to.equal(BigInt(DURATION) * 2n);
    });

    it("Should preserve expiration after transfer", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).mint();

      const expiryBefore = await arcSignPro.expiresAt(1);
      await arcSignPro.connect(user1).transferFrom(user1.address, user2.address, 1);
      const expiryAfter = await arcSignPro.expiresAt(1);

      expect(expiryAfter).to.equal(expiryBefore);
    });

    it("Should support EIP-4906 interface", async function () {
      // EIP-4906 interface ID: 0x49064906
      expect(await arcSignPro.supportsInterface("0x49064906")).to.be.true;
    });

    it("Should emit MembershipMinted event with correct params", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);

      const tx = await arcSignPro.connect(user1).mint();
      const receipt = await tx.wait();
      const expiry = await arcSignPro.expiresAt(1);

      await expect(tx)
        .to.emit(arcSignPro, "MembershipMinted")
        .withArgs(user1.address, 1, expiry);
    });

    it("Should handle user with multiple valid and expired NFTs", async function () {
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE * 2n);
      await arcSignPro.connect(user1).mint(); // token 1
      await arcSignPro.connect(user1).mint(); // token 2

      // Expire token 1 by waiting, but token 2 is also expired since minted at same time
      // Instead, renew token 2 to keep it active
      await time.increase(DURATION - 100);
      await mockUSDT.connect(user1).approve(await arcSignPro.getAddress(), PRICE);
      await arcSignPro.connect(user1).renew(2);

      await time.increase(200); // Now token 1 is expired, token 2 still active

      expect(await arcSignPro.isValidMember(user1.address)).to.be.true;

      const [, , valid] = await arcSignPro.getMemberships(user1.address);
      expect(valid[0]).to.be.false; // token 1 expired
      expect(valid[1]).to.be.true;  // token 2 active
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
