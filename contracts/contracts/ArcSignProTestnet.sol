// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArcSignProTestnet
 * @dev Testnet version - accepts BNB for easy testing
 *
 * TESTNET ONLY - DO NOT USE IN PRODUCTION
 *
 * Features:
 * - Pay 0.001 tBNB to mint Pro membership NFT (low cost for testing)
 * - 1 year validity period
 * - Renewable before or after expiry
 * - Transferable
 */
contract ArcSignProTestnet is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {

    // ============ Constants ============

    /// @notice Membership duration: 1 year
    uint256 public constant DURATION = 365 days;

    /// @notice Membership price: 0.001 tBNB (for easy testing)
    uint256 public constant PRICE = 0.001 ether;

    // ============ State Variables ============

    /// @notice Next token ID to mint
    uint256 private _nextTokenId;

    /// @notice Expiration timestamp for each token
    mapping(uint256 => uint256) public expiresAt;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Treasury address to receive payments
    address public treasury;

    // ============ Events ============

    event MembershipMinted(address indexed owner, uint256 indexed tokenId, uint256 expiresAt);
    event MembershipRenewed(uint256 indexed tokenId, uint256 newExpiresAt);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event BaseURIUpdated(string newBaseURI);
    event Withdrawn(address indexed to, uint256 amount);

    // ============ Constructor ============

    /**
     * @param _treasury Address to receive payments
     */
    constructor(
        address _treasury
    ) ERC721("ArcSign Pro Testnet", "ARCPRO-TEST") Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");

        treasury = _treasury;
        _nextTokenId = 1;
    }

    // ============ External Functions ============

    /**
     * @notice Mint a new Pro membership NFT with BNB
     * @dev Requires exact payment of 0.001 tBNB
     */
    function mint() external payable nonReentrant {
        require(msg.value >= PRICE, "Insufficient payment");

        // Transfer payment to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Payment transfer failed");

        // Mint NFT
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        // Set expiration (1 year from now)
        uint256 expiry = block.timestamp + DURATION;
        expiresAt[tokenId] = expiry;

        emit MembershipMinted(msg.sender, tokenId, expiry);
    }

    /**
     * @notice Renew an existing membership with BNB
     * @param tokenId Token ID to renew
     * @dev Can be called by anyone (gift renewal)
     */
    function renew(uint256 tokenId) external payable nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(msg.value >= PRICE, "Insufficient payment");

        // Transfer payment to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Payment transfer failed");

        // Calculate new expiration
        uint256 currentExpiry = expiresAt[tokenId];
        uint256 newExpiry;

        if (currentExpiry < block.timestamp) {
            // Expired: renew from now
            newExpiry = block.timestamp + DURATION;
        } else {
            // Active: extend from current expiry
            newExpiry = currentExpiry + DURATION;
        }

        expiresAt[tokenId] = newExpiry;

        emit MembershipRenewed(tokenId, newExpiry);
    }

    /**
     * @notice Check if an address holds a valid (non-expired) membership
     * @param owner Address to check
     * @return True if address owns at least one valid membership
     */
    function isValidMember(address owner) external view returns (bool) {
        uint256 balance = balanceOf(owner);

        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            if (expiresAt[tokenId] > block.timestamp) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Get all token IDs owned by an address with their expiration status
     * @param owner Address to query
     * @return tokenIds Array of token IDs
     * @return expirations Array of expiration timestamps
     * @return valid Array of validity status
     */
    function getMemberships(address owner) external view returns (
        uint256[] memory tokenIds,
        uint256[] memory expirations,
        bool[] memory valid
    ) {
        uint256 balance = balanceOf(owner);

        tokenIds = new uint256[](balance);
        expirations = new uint256[](balance);
        valid = new bool[](balance);

        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            tokenIds[i] = tokenId;
            expirations[i] = expiresAt[tokenId];
            valid[i] = expiresAt[tokenId] > block.timestamp;
        }
    }

    /**
     * @notice Get time remaining until expiration
     * @param tokenId Token ID to check
     * @return Seconds until expiration (0 if expired)
     */
    function timeUntilExpiry(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        uint256 expiry = expiresAt[tokenId];
        if (expiry <= block.timestamp) {
            return 0;
        }

        return expiry - block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /**
     * @notice Withdraw accidentally sent BNB
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        (bool success, ) = to.call{value: amount}("");
        require(success, "BNB transfer failed");

        emit Withdrawn(to, amount);
    }

    // ============ Internal Functions ============

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ============ Required Overrides ============

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ============ Receive BNB ============

    receive() external payable {}
}
