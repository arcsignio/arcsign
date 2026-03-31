// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArcSignReferral
 * @dev On-chain referral registry for ArcSign Wallet
 *
 * Features:
 * - Each address can register a unique referral code (auto-increment uint32)
 * - Users can set their referrer once (permanent, immutable)
 * - Tracks referral count per referrer
 * - Commission settlement is off-chain; this contract is the trustless registry
 *
 * Chain: BNB Chain (BSC)
 */
contract ArcSignReferral is Ownable {
    // ============ State ============

    /// @notice Next referral code to assign (starts at 1, 0 = unregistered)
    uint32 public nextCode = 1;

    /// @notice Referral code → owner address
    mapping(uint32 => address) public codeToAddress;

    /// @notice Address → referral code (0 = not registered)
    mapping(address => uint32) public addressToCode;

    /// @notice User → referrer address
    mapping(address => address) public referrerOf;

    /// @notice User → whether referrer has been set
    mapping(address => bool) public hasReferrer;

    /// @notice Referrer → number of users referred
    mapping(address => uint32) public referralCount;

    // ============ Events ============

    event CodeRegistered(address indexed user, uint32 code);
    event ReferrerSet(address indexed user, address indexed referrer, uint32 referrerCode);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Write Functions ============

    /// @notice Register a referral code for the caller (one per address)
    /// @return code The assigned referral code
    function registerCode() external returns (uint32) {
        require(addressToCode[msg.sender] == 0, "Already registered");

        uint32 code = nextCode++;
        codeToAddress[code] = msg.sender;
        addressToCode[msg.sender] = code;

        emit CodeRegistered(msg.sender, code);
        return code;
    }

    /// @notice Set referrer by code (one-time, permanent, cannot be changed)
    /// @param code The referrer's referral code
    function setReferrer(uint32 code) external {
        require(!hasReferrer[msg.sender], "Already set");
        require(code > 0 && codeToAddress[code] != address(0), "Invalid code");
        require(codeToAddress[code] != msg.sender, "Self referral");

        address referrer = codeToAddress[code];
        referrerOf[msg.sender] = referrer;
        hasReferrer[msg.sender] = true;
        referralCount[referrer]++;

        emit ReferrerSet(msg.sender, referrer, code);
    }

    // ============ View Functions ============

    /// @notice Get referral code for an address (0 = not registered)
    function getCode(address user) external view returns (uint32) {
        return addressToCode[user];
    }

    /// @notice Get referrer info for an address
    /// @return referrer The referrer's address (address(0) if none)
    /// @return referrerCode The referrer's code (0 if none)
    function getReferrer(address user) external view returns (address referrer, uint32 referrerCode) {
        referrer = referrerOf[user];
        referrerCode = addressToCode[referrer];
    }

    /// @notice Get how many users an address has referred
    function getReferralCount(address user) external view returns (uint32) {
        return referralCount[user];
    }

    /// @notice Resolve a referral code to its owner address
    function resolveCode(uint32 code) external view returns (address) {
        return codeToAddress[code];
    }
}
