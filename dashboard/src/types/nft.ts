/**
 * NFT types for NFT Gallery display
 * Feature: NFT Gallery in Dashboard WalletDetail
 */

export interface NFT {
  address: string;         // Owner wallet address
  network: string;         // Internal Network ID (e.g., "eth-mainnet")
  networkLabel: string;    // Human-readable (e.g., "Ethereum")
  contractAddress: string; // NFT contract address
  tokenId: string;         // Token ID within collection
  tokenType: string;       // "ERC721" or "ERC1155"
  name: string;            // NFT name
  description: string;     // NFT description
  imageUrl: string;        // Best available image URL
  thumbnailUrl: string;    // Thumbnail URL
  collectionName: string;  // Collection name
  collectionSlug: string;  // Collection slug
  balance: string;         // Balance ("1" for ERC721, may be more for ERC1155)
}

export interface NFTsResponse {
  nfts: NFT[];
  totalCount: number;
  addressCount: number;
  networkCount: number;
}

export interface GetNFTsParams {
  walletId: string;
  password: string;
  usbPath: string;
  sessionToken?: string;
  appPassword?: string;
}
