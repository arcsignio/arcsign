/**
 * Provider Configuration API Client
 * Feature: Provider Registry System - API Key Management
 */

import { invoke } from '@tauri-apps/api/tauri';

export interface ProviderConfig {
  providerType: string;
  apiKey: string;
  chainId: string;
  networkId?: string;
  customEndpoint?: string;
  priority?: number;
  enabled?: boolean;
  password: string;
  usbPath: string;
}

export interface ProviderConfigResponse {
  providerType: string;
  chainId: string;
  networkId?: string;
  priority: number;
  enabled: boolean;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderListItem {
  providerType: string;
  chainId: string;
  networkId?: string;
  priority: number;
  enabled: boolean;
  hasApiKey: boolean;
}

/**
 * Set a blockchain provider configuration
 */
export async function setProviderConfig(config: ProviderConfig): Promise<void> {
  try {
    await invoke('set_provider_config', { input: config });
  } catch (error) {
    console.error('Failed to set provider config:', error);
    throw error;
  }
}

/**
 * Get a blockchain provider configuration
 */
export async function getProviderConfig(
  chainId: string,
  providerType: string | null,
  password: string,
  usbPath: string
): Promise<ProviderConfigResponse> {
  try {
    const result = await invoke<ProviderConfigResponse>('get_provider_config', {
      input: {
        chainId,
        providerType,
        password,
        usbPath,
      },
    });
    return result;
  } catch (error) {
    console.error('Failed to get provider config:', error);
    throw error;
  }
}

/**
 * List all provider configurations (optionally filter by chain)
 */
export async function listProviderConfigs(
  chainId: string | null,
  password: string,
  usbPath: string
): Promise<ProviderListItem[]> {
  try {
    const result = await invoke<{ providers: ProviderListItem[]; count: number }>(
      'list_provider_configs',
      {
        input: {
          chainId,
          password,
          usbPath,
        },
      }
    );
    return result.providers;
  } catch (error) {
    console.error('Failed to list provider configs:', error);
    throw error;
  }
}

/**
 * Delete a provider configuration
 */
export async function deleteProviderConfig(
  chainId: string,
  providerType: string,
  password: string,
  usbPath: string
): Promise<void> {
  try {
    await invoke('delete_provider_config', {
      input: {
        chainId,
        providerType,
        password,
        usbPath,
      },
    });
  } catch (error) {
    console.error('Failed to delete provider config:', error);
    throw error;
  }
}

/**
 * Provider types supported by the system
 */
export const PROVIDER_TYPES = {
  ALCHEMY: 'alchemy',
  INFURA: 'infura',
  QUICKNODE: 'quicknode',
} as const;

/**
 * Supported blockchain IDs
 */
export const CHAIN_IDS = {
  ETHEREUM: 'ethereum',
  BITCOIN: 'bitcoin',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  BASE: 'base',
} as const;

/**
 * Network IDs for each chain
 */
export const NETWORK_IDS = {
  ethereum: ['mainnet', 'sepolia', 'goerli'],
  polygon: ['mainnet', 'mumbai'],
  arbitrum: ['mainnet', 'sepolia'],
  optimism: ['mainnet', 'sepolia'],
  base: ['mainnet', 'sepolia'],
} as const;
