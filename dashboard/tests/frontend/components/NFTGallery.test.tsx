import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock tauriApi
vi.mock('@/services/tauri-api', () => ({
  default: {
    getNFTs: vi.fn(),
  },
}));

// Mock useMembership hook
vi.mock('@/hooks/useMembership', () => ({
  useMembership: vi.fn(),
}));

// Mock LoadingSpinner
vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock chainIcons
vi.mock('@/utils/chainIcons', () => ({
  getChainIconUrl: vi.fn(() => ''),
  getChainFallbackIcon: vi.fn(() => ''),
}));

// Mock contracts constant
vi.mock('@/constants/contracts', () => ({
  ACTIVE_NETWORK: { nftContract: '0xNFTContract', explorer: 'https://bscscan.com' },
  APPROVE_SELECTOR: '0x095ea7b3',
}));

// Mock useHasProviderKey hook
vi.mock('@/hooks/useHasProviderKey', () => ({
  useHasProviderKey: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { useMembership } from '@/hooks/useMembership';
import { useHasProviderKey } from '@/hooks/useHasProviderKey';

import { NFTGallery } from '@/components/NFTGallery';

const defaultProps = {
  walletId: 'w1',
  password: 'pw',
  usbPath: '/dev/usb0',
  sessionToken: 'token',
  bscAddress: '0xbscaddr',
};

const mockNFTs = [
  {
    address: '0xuser',
    network: 'eth-mainnet',
    networkLabel: 'Ethereum',
    contractAddress: '0xcontract1',
    tokenId: '1',
    tokenType: 'ERC721',
    name: 'Cool Cat #1',
    description: 'A cool cat',
    imageUrl: 'https://example.com/cat1.png',
    thumbnailUrl: 'https://example.com/cat1-thumb.png',
    collectionName: 'Cool Cats',
    collectionSlug: 'cool-cats',
    balance: '1',
  },
  {
    address: '0xuser',
    network: 'polygon-mainnet',
    networkLabel: 'Polygon',
    contractAddress: '0xcontract2',
    tokenId: '42',
    tokenType: 'ERC721',
    name: 'Poly NFT #42',
    description: 'A polygon NFT',
    imageUrl: 'https://example.com/poly42.png',
    thumbnailUrl: 'https://example.com/poly42-thumb.png',
    collectionName: 'Poly Collection',
    collectionSlug: 'poly-collection',
    balance: '1',
  },
];

function setupDefaultMocks() {
  (tauriApi.getNFTs as any).mockImplementation(() =>
    Promise.resolve({ nfts: [] })
  );
  (useMembership as any).mockReturnValue({
    status: null,
    isLoading: false,
    error: null,
    isPro: false,
    walletLimit: 1,
    refresh: vi.fn(),
  });
  (useHasProviderKey as any).mockReturnValue({
    hasAlchemyKey: true,
    hasNodeRealKey: true,
    isLoading: false,
  });
}

describe('NFTGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows empty state when no NFTs', async () => {
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('nftGallery.empty')).toBeInTheDocument();
    });
    unmount();
  });

  it('shows error state on fetch failure', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.reject(new Error('Fetch failed'))
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Fetch failed/)).toBeInTheDocument();
    });
    unmount();
  });

  it('calls getNFTs on mount', async () => {
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(tauriApi.getNFTs).toHaveBeenCalled();
    });
    unmount();
  });

  it('renders membership NFT when user is Pro', async () => {
    (useMembership as any).mockReturnValue({
      status: {
        isPro: true,
        nftCount: 1,
        tokenIds: [99],
        expirations: [],
        daysRemaining: 365,
        walletLimit: 10,
      },
      isLoading: false,
      error: null,
      isPro: true,
      walletLimit: 10,
      refresh: vi.fn(),
    });

    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText(/ArcSign Pro/).length).toBeGreaterThanOrEqual(1);
    });
    unmount();
  });

  it('displays NFTs after loading', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
      expect(screen.getByText('Poly NFT #42')).toBeInTheDocument();
    });
    unmount();
  });

  it('does not show membership NFT when user is not Pro', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });
    expect(screen.queryByText(/ArcSign Pro/)).not.toBeInTheDocument();
    unmount();
  });

  // --- Network filter tests ---

  it('shows network filter chips when NFTs span multiple networks', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });
    // "All Networks" chip plus per-network chips
    expect(screen.getByText('nftGallery.allNetworks')).toBeInTheDocument();
    unmount();
  });

  it('filters NFTs by network when a network chip is clicked', async () => {
    const user = userEvent.setup();
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // Click the Ethereum filter chip (the chip button, not the badge on the card)
    const ethChips = screen.getAllByText('Ethereum');
    // The filter chip is a <button>; find the one that is a button
    const ethFilterBtn = ethChips.find((el) => el.closest('button'));
    await user.click(ethFilterBtn!);

    // Only Ethereum NFT should be visible
    expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    expect(screen.queryByText('Poly NFT #42')).not.toBeInTheDocument();
    unmount();
  });

  it('shows all NFTs again when "All Networks" chip is clicked after filtering', async () => {
    const user = userEvent.setup();
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // First filter to Ethereum
    const ethChips = screen.getAllByText('Ethereum');
    const ethFilterBtn = ethChips.find((el) => el.closest('button'));
    await user.click(ethFilterBtn!);
    expect(screen.queryByText('Poly NFT #42')).not.toBeInTheDocument();

    // Click "All Networks" to reset
    await user.click(screen.getByText('nftGallery.allNetworks'));
    expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    expect(screen.getByText('Poly NFT #42')).toBeInTheDocument();
    unmount();
  });

  // --- NFT card click / detail modal tests ---

  it('opens detail view when an NFT card is clicked', async () => {
    const user = userEvent.setup();
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // Click the NFT card
    await user.click(screen.getByText('Cool Cat #1'));

    // Detail view should show back button and detail rows
    expect(screen.getByText('nftGallery.backToGallery')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.network')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.tokenType')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.tokenId')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.contract')).toBeInTheDocument();
    // Description shown for non-Pro NFTs
    expect(screen.getByText('A cool cat')).toBeInTheDocument();
    unmount();
  });

  it('goes back to gallery when back button is clicked in detail view', async () => {
    const user = userEvent.setup();
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // Open detail
    await user.click(screen.getByText('Cool Cat #1'));
    expect(screen.getByText('nftGallery.backToGallery')).toBeInTheDocument();

    // Click back
    await user.click(screen.getByText('nftGallery.backToGallery'));

    // Should be back in gallery - both NFTs visible
    expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    expect(screen.getByText('Poly NFT #42')).toBeInTheDocument();
    unmount();
  });

  // --- Retry handler in error state ---

  it('retries loading when retry button is clicked in error state', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    (tauriApi.getNFTs as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ nfts: mockNFTs });
    });

    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Click retry
    await user.click(screen.getByText('nftGallery.retry'));

    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });
    expect(tauriApi.getNFTs).toHaveBeenCalledTimes(2);
    unmount();
  });

  // --- Image error handler ---

  it('shows fallback when image fails to load in gallery grid', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [mockNFTs[0]] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // Find the img and trigger error
    const img = screen.getByAltText('Cool Cat #1');
    fireEvent.error(img);

    // After error, image should be replaced with SVG fallback (no <img> for that NFT)
    expect(screen.queryByAltText('Cool Cat #1')).not.toBeInTheDocument();
    unmount();
  });

  it('shows fallback when image fails to load in detail view', async () => {
    const user = userEvent.setup();
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [mockNFTs[0]] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // Open detail
    await user.click(screen.getByText('Cool Cat #1'));
    expect(screen.getByText('nftGallery.backToGallery')).toBeInTheDocument();

    // Find the detail image and trigger error
    const img = screen.getByAltText('Cool Cat #1');
    fireEvent.error(img);

    // After error, image should be gone
    expect(screen.queryByAltText('Cool Cat #1')).not.toBeInTheDocument();
    unmount();
  });

  // --- Pro membership detail view ---

  it('shows PRO badge and membership details in detail view for Pro NFTs', async () => {
    const user = userEvent.setup();
    (useMembership as any).mockReturnValue({
      status: {
        isPro: true,
        nftCount: 1,
        tokenIds: [99],
        expirations: [],
        daysRemaining: 365,
        walletLimit: 10,
      },
      isLoading: false,
      error: null,
      isPro: true,
      walletLimit: 10,
      refresh: vi.fn(),
    });

    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText(/ArcSign Pro/).length).toBeGreaterThanOrEqual(1);
    });

    // Click the Pro NFT card
    await user.click(screen.getByText('ArcSign Pro #99'));

    // Detail view should show PRO badge, days remaining, wallet quota
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.daysRemaining')).toBeInTheDocument();
    expect(screen.getByText('nftGallery.walletQuota')).toBeInTheDocument();
    // Explorer link for Pro NFTs
    expect(screen.getByText('nftGallery.viewOnExplorer')).toBeInTheDocument();
    unmount();
  });

  // --- Mouse hover events on NFT cards ---

  it('applies hover styles on mouseEnter and resets on mouseLeave', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [mockNFTs[0]] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    // The card is the outermost div wrapping the NFT; get it via the name text parent
    const cardText = screen.getByText('Cool Cat #1');
    const card = cardText.closest('div[style*="cursor: pointer"]')!;

    fireEvent.mouseEnter(card);
    expect(card.style.transform).toBe('translateY(-2px)');

    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe('translateY(0)');
    unmount();
  });

  // --- NFT count display ---

  it('displays correct NFT count text', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: mockNFTs })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });
    // "2 NFTs" text
    expect(screen.getByText('2 NFTs')).toBeInTheDocument();
    unmount();
  });

  it('displays singular NFT count for single NFT', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [mockNFTs[0]] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });
    expect(screen.getByText('1 NFT')).toBeInTheDocument();
    unmount();
  });

  // --- Error with fallback membership NFTs still rendering ---

  it('shows error message but still renders membership NFTs when API fails and user is Pro', async () => {
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.reject(new Error('API down'))
    );
    (useMembership as any).mockReturnValue({
      status: {
        isPro: true,
        nftCount: 1,
        tokenIds: [5],
        expirations: [],
        daysRemaining: 100,
        walletLimit: 10,
      },
      isLoading: false,
      error: null,
      isPro: true,
      walletLimit: 10,
      refresh: vi.fn(),
    });

    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      // Membership NFT should still render even though API failed
      expect(screen.getAllByText(/ArcSign Pro/).length).toBeGreaterThanOrEqual(1);
    });
    // The error state with retry should NOT show because allNfts.length > 0
    expect(screen.queryByText('nftGallery.retry')).not.toBeInTheDocument();
    unmount();
  });

  // --- ERC1155 balance row in detail view ---

  it('shows balance row for ERC1155 NFTs in detail view', async () => {
    const user = userEvent.setup();
    const erc1155NFT = {
      ...mockNFTs[0],
      tokenType: 'ERC1155',
      balance: '5',
    };
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [erc1155NFT] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cool Cat #1'));

    expect(screen.getByText('nftGallery.balance')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    unmount();
  });

  // --- Description truncation in detail view ---

  it('truncates long descriptions in detail view', async () => {
    const user = userEvent.setup();
    const longDesc = 'A'.repeat(250);
    const nftWithLongDesc = {
      ...mockNFTs[0],
      description: longDesc,
    };
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [nftWithLongDesc] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cool Cat #1')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cool Cat #1'));

    // Description should be truncated at 200 chars + "..."
    const truncated = longDesc.slice(0, 200) + '...';
    expect(screen.getByText(truncated)).toBeInTheDocument();
    unmount();
  });

  // --- NFT without name shows tokenId ---

  it('shows tokenId when NFT has no name', async () => {
    const namelessNFT = {
      ...mockNFTs[0],
      name: '',
    };
    (tauriApi.getNFTs as any).mockImplementation(() =>
      Promise.resolve({ nfts: [namelessNFT] })
    );
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      // Should show #tokenId instead of name
      expect(screen.getAllByText('#1').length).toBeGreaterThanOrEqual(1);
    });
    unmount();
  });

  // --- Need-key empty state ---

  it('shows the need-key prompt when no Alchemy key and empty', async () => {
    (useHasProviderKey as any).mockReturnValue({ hasAlchemyKey: false, hasNodeRealKey: false, isLoading: false });
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('nftGallery.needKeyTitle')).toBeInTheDocument();
    });
    expect(screen.queryByText('nftGallery.empty')).not.toBeInTheDocument();
    unmount();
  });

  it('shows the normal empty state when a key is present and empty', async () => {
    (useHasProviderKey as any).mockReturnValue({ hasAlchemyKey: true, hasNodeRealKey: true, isLoading: false });
    const { unmount } = render(<NFTGallery {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('nftGallery.empty')).toBeInTheDocument();
    });
    expect(screen.queryByText('nftGallery.needKeyTitle')).not.toBeInTheDocument();
    unmount();
  });

  it('does not flash empty/need-key text while key status is loading', async () => {
    (useHasProviderKey as any).mockReturnValue({ hasAlchemyKey: false, hasNodeRealKey: false, isLoading: true });
    render(<NFTGallery {...defaultProps} />);
    // 等 getNFTs 解析（空），確認載入中不顯示 needKey 也不顯示 empty 文案
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/nftGallery.needKeyTitle/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nftGallery.empty$/)).not.toBeInTheDocument();
  });
});
