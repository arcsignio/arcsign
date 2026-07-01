import React from "react";
import { useTranslation } from "react-i18next";
import { getNetworkIcon, formatBalance } from "@/utils/swapFormat";
import type { SendableToken } from "@/components/SendTransaction";

/** Token shape for the destination (selectTo) list */
export interface DestToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
}

interface TokenPickerFromProps {
  mode: "from";
  /** Already-grouped source tokens (by networkLabel). Parent computes this. */
  tokensByNetwork: Record<string, SendableToken[]>;
  onSelectToken: (token: SendableToken) => void;
  onBack: () => void;
}

interface TokenPickerToProps {
  mode: "to";
  /** Flat destination token list already computed by parent (getDestinationTokens()). */
  destinationTokens: DestToken[];
  searchQuery: string;
  loadingTokens: boolean;
  /** Whether the token cache has been populated for the current chain. */
  cacheHasTokens: boolean;
  fromTokenSymbol: string;
  fromTokenNetworkLabel: string;
  onSearch: (query: string) => void;
  onSelectToken: (token: DestToken) => void;
}

export type TokenPickerProps = TokenPickerFromProps | TokenPickerToProps;

export const TokenPicker: React.FC<TokenPickerProps> = (props) => {
  const { t } = useTranslation();

  if (props.mode === "from") {
    const { tokensByNetwork, onSelectToken, onBack } = props;
    const hasTokens = Object.keys(tokensByNetwork).length > 0;

    return (
      <div className="token-select-form">
        <h3>{t('swap.selectTokenToSwap')}</h3>
        <p className="select-description">{t('swap.chooseAssetToSwap')}</p>

        {!hasTokens ? (
          <div className="no-tokens">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <p>{t('swap.noTokensForSwap')}</p>
            <p className="supported-chains">{t('swap.supportedChains')}</p>
            <button className="secondary-button" onClick={onBack}>
              {t('swap.goBack')}
            </button>
          </div>
        ) : (
          <div className="token-list">
            {Object.entries(tokensByNetwork).map(([networkLabel, tokens]) => (
              <div key={networkLabel} className="network-group">
                <div className="network-header">
                  <span className="network-icon">{getNetworkIcon(tokens[0].network)}</span>
                  <span className="network-name">{networkLabel}</span>
                </div>
                <div className="network-tokens">
                  {tokens.map((token, idx) => (
                    <button
                      key={`${token.network}-${token.tokenAddress || "native"}-${idx}`}
                      className="token-option"
                      onClick={() => onSelectToken(token)}
                    >
                      <div className="token-icon">
                        {token.tokenLogo ? (
                          <img
                            src={token.tokenLogo}
                            alt={token.tokenSymbol}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'flex');
                            }}
                          />
                        ) : null}
                        <span className="token-icon-fallback" style={token.tokenLogo ? { display: 'none' } : undefined}>{token.tokenSymbol.slice(0, 2)}</span>
                      </div>
                      <div className="token-info">
                        <span className="token-symbol">{token.tokenSymbol}</span>
                        <span className="token-name">{token.tokenName}</span>
                      </div>
                      <div className="token-balance">
                        <span className="balance-amount">{formatBalance(token.balance)}</span>
                      </div>
                      <span className="token-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // mode === "to"
  const {
    destinationTokens,
    searchQuery,
    loadingTokens,
    cacheHasTokens,
    fromTokenSymbol,
    fromTokenNetworkLabel,
    onSearch,
    onSelectToken,
  } = props;

  return (
    <div className="token-select-form">
      <h3>{t('swap.selectTokenToReceive')}</h3>
      <p className="select-description">
        {t('swap.swappingFrom', { symbol: fromTokenSymbol, network: fromTokenNetworkLabel })}
      </p>

      {/* Search Input */}
      <div className="token-search-wrapper">
        <input
          type="text"
          placeholder={t('swap.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="token-search-input"
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => onSearch("")}
          >
            ✕
          </button>
        )}
      </div>

      {/* Loading State */}
      {loadingTokens && (
        <div className="token-loading">
          <div className="token-loading-spinner"></div>
          <span>{t('swap.loadingTokenRegistry')}</span>
        </div>
      )}

      {/* Token Count Info */}
      {!loadingTokens && cacheHasTokens && (
        <div className="token-count-info">
          {t('swap.tokensAvailable', { count: destinationTokens.length })}
          {searchQuery && ` (${t('swap.filtered')})`}
        </div>
      )}

      <div className="token-list">
        {destinationTokens.length === 0 && !loadingTokens ? (
          <div className="no-tokens-found">
            {searchQuery
              ? t('swap.noTokensMatching', { query: searchQuery })
              : t('swap.noTokensAvailable')}
          </div>
        ) : (
          destinationTokens.map((token, idx) => (
            <button
              key={`${token.address}-${idx}`}
              className="token-option"
              onClick={() => onSelectToken(token)}
            >
              <div className="token-icon">
                {token.logoURI ? (
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'flex');
                    }}
                  />
                ) : null}
                <span className="token-icon-fallback" style={token.logoURI ? { display: 'none' } : undefined}>{token.symbol.slice(0, 2)}</span>
              </div>
              <div className="token-info">
                <span className="token-symbol">{token.symbol}</span>
                <span className="token-name">{token.name}</span>
              </div>
              {token.balance && (
                <div className="token-balance">
                  <span className="balance-amount">{formatBalance(token.balance)}</span>
                </div>
              )}
              <span className="token-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
