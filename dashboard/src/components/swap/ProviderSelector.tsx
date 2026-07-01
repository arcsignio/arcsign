import React from "react";
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
    <div className="provider-selector">
      <button
        className="provider-badge"
        onClick={onToggleDropdown}
      >
        <img
          src={currentProvider.logoUrl}
          alt={currentProvider.name}
          className="provider-logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <span className="provider-name">{currentProvider.name}</span>
        <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
      </button>
      {showDropdown && (
        <div className="provider-dropdown">
          {AVAILABLE_PROVIDERS.map(provider => (
            <button
              key={provider.id}
              className={`provider-option ${provider.id === selectedProvider ? 'selected' : ''}`}
              onClick={() => onSelectProvider(provider.id)}
            >
              <img
                src={provider.logoUrl}
                alt={provider.name}
                className="provider-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="provider-info">
                <span className="provider-name">{provider.name}</span>
                <span className="provider-desc">{provider.description}</span>
              </div>
              {provider.id === selectedProvider && <span className="check-mark">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
