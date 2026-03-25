import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DefiPositions } from '@/components/DefiPositions';
import type { TokenBalance } from '@/types/tokens';

// Mock staking registry
vi.mock('@/constants/stakingRegistry', () => ({
  getStakableAssetsWithMetrics: vi.fn(),
}));

import { getStakableAssetsWithMetrics } from '@/constants/stakingRegistry';

const mockStETH: TokenBalance = {
  address: '0xuser123',
  network: 'eth-mainnet',
  networkLabel: 'Ethereum',
  tokenAddress: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
  tokenSymbol: 'stETH',
  tokenName: 'Lido Staked Ether',
  tokenLogo: 'https://example.com/steth.png',
  balance: '1.5',
  rawBalance: '1500000000000000000',
  decimals: 18,
  usdValue: 4500,
  priceUsd: 3000,
};

const mockAnkrBNB: TokenBalance = {
  address: '0xuser456',
  network: 'bsc-mainnet',
  networkLabel: 'BNB Chain',
  tokenAddress: '0x52f24a5e03aee338da5fd9df68d2b6fae1178827',
  tokenSymbol: 'ankrBNB',
  tokenName: 'Ankr Staked BNB',
  tokenLogo: '',
  balance: '10.0',
  rawBalance: '10000000000000000000',
  decimals: 18,
  usdValue: 6000,
  priceUsd: 600,
};

const mockRegularToken: TokenBalance = {
  address: '0xuser789',
  network: 'eth-mainnet',
  networkLabel: 'Ethereum',
  tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  tokenSymbol: 'USDC',
  tokenName: 'USD Coin',
  tokenLogo: '',
  balance: '1000',
  rawBalance: '1000000000',
  decimals: 6,
  usdValue: 1000,
  priceUsd: 1,
};

const mockProviders = [
  {
    asset: 'ETH',
    providers: [
      { id: 'lido-eth', name: 'Lido', apy: 3.5, verified: true, audits: [{ auditor: 'Sigma Prime' }], logoUrl: '' },
      { id: 'ankr-eth', name: 'Ankr ETH', apy: 3.2, verified: false, audits: [], logoUrl: '' },
    ],
  },
  {
    asset: 'BNB',
    providers: [
      { id: 'ankr-bnb', name: 'Ankr BNB', apy: 4.1, verified: true, audits: [{ auditor: 'Hacken' }], logoUrl: '' },
    ],
  },
];

describe('DefiPositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getStakableAssetsWithMetrics as any).mockResolvedValue(mockProviders);
  });

  it('shows empty state when no receipt tokens', async () => {
    render(<DefiPositions tokens={[mockRegularToken]} />);
    await waitFor(() => {
      expect(screen.getByText('defiPositions.empty')).toBeInTheDocument();
    });
  });

  it('shows empty state when tokens array is empty', async () => {
    render(<DefiPositions tokens={[]} />);
    expect(screen.getByText('defiPositions.empty')).toBeInTheDocument();
  });

  it('detects stETH by contract address and displays position', async () => {
    render(<DefiPositions tokens={[mockStETH]} />);
    await waitFor(() => {
      expect(screen.getByText('Lido')).toBeInTheDocument();
      expect(screen.getByText(/1\.500/)).toBeInTheDocument();
    });
  });

  it('detects ankrBNB by contract address', async () => {
    render(<DefiPositions tokens={[mockAnkrBNB]} />);
    await waitFor(() => {
      expect(screen.getByText('Ankr BNB')).toBeInTheDocument();
    });
  });

  it('shows APY when provider data is loaded', async () => {
    render(<DefiPositions tokens={[mockStETH]} />);
    await waitFor(() => {
      expect(screen.getByText('3.50% APY')).toBeInTheDocument();
    });
  });

  it('shows total staked USD value', async () => {
    render(<DefiPositions tokens={[mockStETH, mockAnkrBNB]} />);
    await waitFor(() => {
      expect(screen.getByText('defiPositions.totalStaked')).toBeInTheDocument();
      // $4,500 + $6,000 = $10,500
      expect(screen.getByText('$10,500.00')).toBeInTheDocument();
    });
  });

  it('shows multiple positions count', async () => {
    render(<DefiPositions tokens={[mockStETH, mockAnkrBNB]} />);
    await waitFor(() => {
      expect(screen.getByText(/2.*defiPositions.activePositions/)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully (still renders)', async () => {
    (getStakableAssetsWithMetrics as any).mockRejectedValue(new Error('fail'));
    render(<DefiPositions tokens={[mockStETH]} />);
    await waitFor(() => {
      // Should still render the position even without APY data
      expect(screen.getByText('Lido Staked Ether')).toBeInTheDocument();
    });
  });

  it('shows verified badge for verified providers', async () => {
    render(<DefiPositions tokens={[mockStETH]} />);
    await waitFor(() => {
      expect(screen.getByText('defiPositions.verified')).toBeInTheDocument();
    });
  });

  it('detects token by symbol when contract address does not match', async () => {
    const tokenBySymbol: TokenBalance = {
      ...mockStETH,
      tokenAddress: '0xunknown',
      tokenSymbol: 'ankrETH',
    };
    render(<DefiPositions tokens={[tokenBySymbol]} />);
    await waitFor(() => {
      expect(screen.getByText('Ankr ETH')).toBeInTheDocument();
    });
  });
});
