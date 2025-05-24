import { useState, useEffect, useCallback } from 'react';
import { useXellarWallet } from './use-xellar-wallet';

// Define the connected account type
export interface ConnectedAccount {
  id: string;
  name: string;
  handle: string;
  iconUrl: string;
  verified: boolean;
  provider: string;
  connectionDate?: string; // ISO date string
}

// Define the identity provider type
export interface IdentityProvider {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  url?: string;
}

// Mock connected accounts for fallback
const mockConnectedAccounts: ConnectedAccount[] = [
  { 
    id: 'lens', 
    name: 'Lens Protocol', 
    handle: '@trustuser.lens', 
    iconUrl: '', 
    verified: true, 
    provider: 'lens' 
  },
  { 
    id: 'farcaster', 
    name: 'Farcaster', 
    handle: '@trustuser', 
    iconUrl: '', 
    verified: false,
    provider: 'farcaster' 
  }
];

// Available identity providers
export const identityProviders: IdentityProvider[] = [
  { id: 'lens', name: 'Lens Protocol', description: 'Social media platform built on blockchain' },
  { id: 'farcaster', name: 'Farcaster', description: 'Decentralized social network' },
  { id: 'ceramic', name: 'Ceramic Network', description: 'Decentralized data network for Web3' },
  { id: 'ens', name: 'Ethereum Name Service', description: 'Decentralized naming for wallets, websites, & more' },
];

// Local storage key
const IDENTITY_STORAGE_KEY = 'strapt_identity';

/**
 * Hook to manage decentralized identity connections
 */
export function useDecentralizedIdentity() {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useXellarWallet();

  // Load connected accounts from local storage
  useEffect(() => {
    const loadConnectedAccounts = () => {
      if (!address) {
        setConnectedAccounts(mockConnectedAccounts);
        setIsLoading(false);
        return;
      }

      try {
        // Use a user-specific key to store connected accounts
        const storageKey = `${IDENTITY_STORAGE_KEY}_${address}`;
        const storedAccounts = localStorage.getItem(storageKey);
        
        if (storedAccounts) {
          const parsedAccounts = JSON.parse(storedAccounts);
          setConnectedAccounts(parsedAccounts);
        } else {
          // If no stored accounts, use mock data
          setConnectedAccounts(mockConnectedAccounts);
        }
      } catch (error) {
        console.error('Error loading connected accounts:', error);
        setConnectedAccounts(mockConnectedAccounts);
      }
      
      setIsLoading(false);
    };

    loadConnectedAccounts();
  }, [address]);

  // Save connected accounts to local storage
  const saveConnectedAccounts = useCallback((updatedAccounts: ConnectedAccount[]) => {
    if (!address) return;

    try {
      const storageKey = `${IDENTITY_STORAGE_KEY}_${address}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedAccounts));
    } catch (error) {
      console.error('Error saving connected accounts:', error);
    }
  }, [address]);

  // Connect a new account
  const connectAccount = useCallback((providerId: string) => {
    if (!address) return;

    // In a real app, this would initiate an authentication flow
    // For now, we'll simulate connecting by adding a mock account

    // Check if already connected
    const isAlreadyConnected = connectedAccounts.some(account => account.id === providerId);
    if (isAlreadyConnected) return;

    const provider = identityProviders.find(p => p.id === providerId);
    if (!provider) return;

    const newAccount: ConnectedAccount = {
      id: providerId,
      name: provider.name,
      handle: `@${address.slice(2, 8).toLowerCase()}${providerId === 'lens' ? '.lens' : ''}`,
      iconUrl: provider.iconUrl || '',
      verified: false,
      provider: providerId,
      connectionDate: new Date().toISOString()
    };

    setConnectedAccounts(prevAccounts => {
      const updatedAccounts = [...prevAccounts, newAccount];
      saveConnectedAccounts(updatedAccounts);
      return updatedAccounts;
    });
  }, [address, connectedAccounts, saveConnectedAccounts]);

  // Disconnect an account
  const disconnectAccount = useCallback((accountId: string) => {
    if (!address) return;

    setConnectedAccounts(prevAccounts => {
      const updatedAccounts = prevAccounts.filter(account => account.id !== accountId);
      saveConnectedAccounts(updatedAccounts);
      return updatedAccounts;
    });
  }, [address, saveConnectedAccounts]);

  // Get available providers (not yet connected)
  const getAvailableProviders = useCallback(() => {
    const connectedIds = connectedAccounts.map(account => account.id);
    return identityProviders.filter(provider => !connectedIds.includes(provider.id));
  }, [connectedAccounts]);

  return {
    connectedAccounts,
    isLoading,
    connectAccount,
    disconnectAccount,
    getAvailableProviders,
    identityProviders
  };
}
