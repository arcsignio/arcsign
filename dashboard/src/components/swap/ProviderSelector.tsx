import React from "react";
import styles from "./swap.module.css";
import { AVAILABLE_PROVIDERS, type SwapProvider } from "@/utils/swapFormat";

interface ProviderSelectorProps {
  selectedProvider: SwapProvider;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onSelectProvider: (provider: SwapProvider) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  showDropdown,
  onToggleDropdown,
  onSelectProvider,
}) => {
  const currentProvider = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider) || AVAILABLE_PROVIDERS[0];

  return (
    <div className={styles.providerSelector}>
      <button
        className={styles.providerBadge}
        onClick={onToggleDropdown}
      >
        <img
          src={currentProvider.logoUrl}
          alt={currentProvider.name}
          className={styles.providerLogo}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <span className={styles.providerName}>{currentProvider.name}</span>
        <span className={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</span>
      </button>
      {showDropdown && (
        <div className={styles.providerDropdown}>
          {AVAILABLE_PROVIDERS.map(provider => (
            <button
              key={provider.id}
              className={`${styles.providerOption} ${provider.id === selectedProvider ? styles.selected : ''}`}
              onClick={() => onSelectProvider(provider.id)}
            >
              <img
                src={provider.logoUrl}
                alt={provider.name}
                className={styles.providerLogo}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className={styles.providerInfo}>
                <span className={styles.providerName}>{provider.name}</span>
                <span className={styles.providerDesc}>{provider.description}</span>
              </div>
              {provider.id === selectedProvider && <span className={styles.checkMark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
