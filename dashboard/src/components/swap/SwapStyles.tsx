import React from "react";

export const SwapStyles: React.FC = () => (
  <style>{`
.swap-transaction {
  min-height: 100vh;
  background: #f8fafc;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #111827;
}

/* Token Select Form - Step 1 & 2 */
.token-select-form {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.token-select-form h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.select-description {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #6b7280;
}

/* No Tokens State */
.no-tokens {
  text-align: center;
  padding: 40px 20px;
}

.no-tokens-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.no-tokens p {
  margin: 0 0 8px 0;
  color: #6b7280;
  font-size: 14px;
}

.supported-chains {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 20px !important;
}

/* Token Search */
.token-search-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.token-search-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  color: #111827;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.token-search-input:focus {
  border-color: #2dd4bf;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.token-search-input::placeholder {
  color: #9ca3af;
}

.search-clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border: none;
  border-radius: 50%;
  color: #6b7280;
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-clear-btn:hover {
  background: #d1d5db;
}

/* Token Loading State */
.token-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}

.token-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Token Count Info */
.token-count-info {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 12px;
  padding-left: 4px;
}

/* No Tokens Found */
.no-tokens-found {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 14px;
}

/* Network Group */
.network-group {
  margin-bottom: 16px;
}

.network-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 12px;
}

.network-icon {
  font-size: 18px;
}

.network-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.network-tokens {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Token Option Button */
.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.token-option:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.token-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-icon-fallback {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.token-icon-small {
  width: 24px;
  height: 24px;
}

.token-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.token-symbol {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.token-name {
  font-size: 13px;
  color: #6b7280;
}

.token-balance {
  text-align: right;
}

.balance-amount {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.token-arrow {
  font-size: 18px;
  color: #9ca3af;
}

/* Chain Badge */
.chain-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 13px;
  color: #374151;
  margin-left: auto;
}

.chain-icon {
  font-size: 14px;
}

/* Swap Input Form - Step 3 */
.swap-input-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.swap-token-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.swap-token-card.from {
  border: 2px solid #e5e7eb;
}

.swap-token-card.to {
  border: 2px solid #e5e7eb;
  background: #f9fafb;
}

.token-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.balance-label {
  font-size: 12px;
  color: #9ca3af;
}

.token-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.amount-input-large {
  flex: 1;
  font-size: 28px;
  font-weight: 600;
  color: #111827;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
}

.amount-input-large::placeholder {
  color: #d1d5db;
}

.token-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 20px;
  cursor: pointer;
}

.dropdown-arrow {
  font-size: 12px;
  color: #6b7280;
}

.token-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.half-button,
.max-button {
  padding: 6px 12px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: 6px;
  color: #0d9488;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.half-button:hover,
.max-button:hover {
  background: #ccfbf1;
}

/* Swap Direction Button */
.swap-direction {
  display: flex;
  justify-content: center;
  margin: -8px 0;
  position: relative;
  z-index: 1;
}

.swap-direction-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.swap-direction-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Quote Details */
.quote-details {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 16px;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #dcfce7;
}

.quote-row:last-child {
  border-bottom: none;
}

.quote-label {
  font-size: 13px;
  color: #6b7280;
}

.quote-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.quote-value.route {
  font-size: 12px;
  color: #6b7280;
}

.min-received {
  font-size: 12px;
  color: #16a34a;
  margin-top: 4px;
}

.amount-display {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

/* Slippage Settings */
.slippage-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.slippage-label {
  font-size: 13px;
  color: #6b7280;
}

.slippage-options {
  display: flex;
  gap: 8px;
}

.slippage-options button {
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.slippage-options button:hover {
  border-color: #9ca3af;
}

.slippage-options button.selected {
  background: #f0fdfa;
  border-color: #2dd4bf;
  color: #0d9488;
}

/* Loading State */
.loading-text {
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}

.swap-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.swap-header h2 {
  flex: 1;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Provider Selector */
.provider-selector {
  position: relative;
}

.provider-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.2s;
}

.provider-badge:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.provider-logo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.provider-badge .provider-name {
  font-weight: 500;
}

.dropdown-arrow {
  font-size: 10px;
  color: #9ca3af;
  margin-left: 2px;
}

.provider-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 280px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: white;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.provider-option:hover {
  background: #f9fafb;
}

.provider-option.selected {
  background: #f0fdfa;
}

.provider-option .provider-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.provider-option .provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-option .provider-name {
  font-weight: 500;
  color: #111827;
  font-size: 14px;
}

.provider-option .provider-desc {
  font-size: 12px;
  color: #6b7280;
}

.check-mark {
  color: #2dd4bf;
  font-weight: bold;
}

.best-route-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #0d9488, #2dd4bf);
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: white;
}

.best-route-icon {
  font-size: 14px;
}

.best-route-tag {
  color: #0d9488;
  font-weight: 600;
}

.fee-free {
  color: #0d9488 !important;
  font-weight: 600;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: background 0.2s;
}

.back-button:hover {
  background: #e5e7eb;
}

.swap-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

/* Token Selection */
.token-selection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.token-selection h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 450px;
  overflow-y: auto;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.token-item:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.token-item.selected {
  background: #f0fdfa;
  border-color: #2dd4bf;
}

.token-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.token-icon-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.token-icon-wrapper img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.token-icon-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.network-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: #f8fafc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: 2px solid #f8fafc;
}

.token-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.token-symbol {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.token-name {
  font-size: 13px;
  color: #6b7280;
}

.token-balance {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.balance-amount {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.balance-network {
  font-size: 12px;
  color: #6b7280;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #9ca3af;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

/* Swap Input Form */
.swap-input-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.swap-input-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.swap-pair-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.swap-token-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.swap-token-card img,
.swap-token-card .token-icon-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.swap-token-card .token-icon-placeholder {
  font-size: 12px;
}

.swap-token-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.swap-token-info .symbol {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.swap-token-info .network {
  font-size: 11px;
  color: #6b7280;
}

.swap-arrow {
  font-size: 20px;
  color: #9ca3af;
}

.amount-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.amount-input-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.amount-input-wrapper {
  display: flex;
  gap: 8px;
}

.amount-input-wrapper input {
  flex: 1;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #111827;
  font-size: 18px;
  font-weight: 500;
  outline: none;
  transition: border-color 0.2s;
}

.amount-input-wrapper input:focus {
  border-color: #2dd4bf;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.amount-input-wrapper input.error {
  border-color: #ef4444;
}

.max-button {
  padding: 8px 16px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: 8px;
  color: #0d9488;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.max-button:hover {
  background: #ccfbf1;
}

.balance-display {
  font-size: 13px;
  color: #6b7280;
}

.amount-error {
  font-size: 13px;
  color: #ef4444;
}

.get-quote-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.get-quote-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.get-quote-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Quote Display */
.quote-display {
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
}

.quote-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #dcfce7;
}

.quote-row:last-child {
  border-bottom: none;
}

.quote-label {
  font-size: 13px;
  color: #6b7280;
}

.quote-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.quote-value.large {
  font-size: 16px;
  font-weight: 600;
}

.quote-value.warning {
  color: #d97706;
}

.quote-value.route {
  font-size: 12px;
  color: #6b7280;
}

/* Slippage Settings */
.slippage-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.slippage-label {
  font-size: 13px;
  color: #6b7280;
}

.slippage-options {
  display: flex;
  gap: 8px;
}

.slippage-option {
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.slippage-option:hover {
  border-color: #9ca3af;
}

.slippage-option.selected {
  background: #f0fdfa;
  border-color: #2dd4bf;
  color: #0d9488;
}

/* Primary and Secondary Buttons */
.primary-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-button {
  padding: 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-button:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Approval Form */
.approve-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approve-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.approve-description {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.approval-details {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.approval-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.approval-label {
  font-size: 13px;
  color: #6b7280;
}

.approval-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.approval-value.address {
  font-family: monospace;
  font-size: 13px;
  color: #374151;
}

/* Password Form */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.swap-summary {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.swap-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.swap-summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  font-size: 13px;
  color: #6b7280;
}

.summary-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.summary-value.highlight {
  color: #16a34a;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.password-input {
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #111827;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.password-input:focus {
  border-color: #2dd4bf;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Processing Form */
.processing-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.processing-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.processing-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.processing-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Success Form */
.success-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.success-form h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.success-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #dcfce7;
  border: 2px solid #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #22c55e;
}

.tx-hash-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 24px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.tx-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tx-hash-link {
  font-family: monospace;
  font-size: 14px;
  color: #0d9488;
  text-decoration: none;
  transition: color 0.2s;
}

.tx-hash-link:hover {
  color: #0f766e;
}

.success-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.success-actions .primary-button,
.success-actions .secondary-button {
  flex: 1;
  min-width: 120px;
}

/* Error Form */
.error-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.error-form h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.error-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  max-width: 300px;
  word-break: break-word;
}

.error-icon-large {
  width: 64px;
  height: 64px;
  background: #fee2e2;
  border: 2px solid #ef4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ef4444;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.error-actions .primary-button,
.error-actions .secondary-button {
  flex: 1;
  min-width: 120px;
}

/* Error text inline */
.error-text {
  font-size: 13px;
  color: #ef4444;
  margin: 4px 0 0 0;
}

/* Error banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 16px;
}

.error-message {
  font-size: 14px;
  color: #991b1b;
}

/* Approval Amount Section */
.approval-amount-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.approval-type-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: #e5e7eb;
  border-radius: 8px;
}

.toggle-button {
  flex: 1;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-button:hover {
  color: #374151;
}

.toggle-button.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.input-with-suffix {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
}

.input-with-suffix input {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #111827;
  outline: none;
}

.input-with-suffix input::placeholder {
  color: #9ca3af;
}

.input-suffix {
  padding: 12px 16px;
  background: #f3f4f6;
  border-left: 1px solid #e5e7eb;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.approval-amount-presets {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.preset-button {
  flex: 1;
  padding: 8px 12px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: 6px;
  font-size: 12px;
  color: #0d9488;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-button:hover {
  background: #ccfbf1;
}

.unlimited-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
  line-height: 1.4;
}

.warning-icon {
  color: #f59e0b;
  font-size: 16px;
  flex-shrink: 0;
}

/* Approving Form (in progress) */
.approving-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.approving-form h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.approving-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.approving-spinner {
  width: 56px;
  height: 56px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.approval-tx-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 320px;
}

.approval-tx-info .tx-hash-display {
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.confirmation-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: #16a34a;
}

.status-indicator {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
}

.status-indicator.pulsing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.approving-note {
  font-size: 12px;
  color: #9ca3af;
  margin: 8px 0 0 0;
  max-width: 280px;
}
  `}</style>
);
