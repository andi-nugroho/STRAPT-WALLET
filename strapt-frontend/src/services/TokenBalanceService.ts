import { updateData } from './DataSubscriptionService';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { useEffect, useState, useCallback } from 'react';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { TokenOption } from '@/components/TokenSelect';

// Cache for token balances
let tokensCache: TokenOption[] = [];
let lastFetchTime = 0;
const FETCH_INTERVAL = 30000; // 30 seconds

/**
 * Initialize the token balance service
 */
export const initTokenBalanceService = () => {
  console.log('Initializing token balance service');
  
  // Start the background refresh process
  startBackgroundRefresh();
};

/**
 * Start background refresh for token balances
 */
const startBackgroundRefresh = () => {
  // Set up interval to fetch token balances
  setInterval(() => {
    fetchTokenBalances();
  }, FETCH_INTERVAL);
};

/**
 * Fetch token balances
 */
export const fetchTokenBalances = async () => {
  try {
    // Skip if we've fetched recently
    const now = Date.now();
    if (now - lastFetchTime < FETCH_INTERVAL) {
      return;
    }
    
    // Update timestamp
    lastFetchTime = now;
    
    // The actual fetching will happen in the hook
    // We'll just notify subscribers that they should refresh
    updateData('tokens', tokensCache);
    
    console.log('Token balances updated');
  } catch (error) {
    console.error('Error fetching token balances:', error);
  }
};

/**
 * Hook to use token balances with automatic updates
 * @returns [tokens, isLoading, error, refetch]
 */
export const useTokenBalancesData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useXellarWallet();
  const { tokens, isLoading: isLoadingTokens, refetch } = useTokenBalances();
  
  // Update the global cache when tokens change
  useEffect(() => {
    if (!isLoadingTokens && tokens) {
      tokensCache = tokens;
      lastFetchTime = Date.now();
      updateData('tokens', tokens);
      setIsLoading(false);
    }
  }, [tokens, isLoadingTokens]);
  
  // Function to manually refresh data
  const refresh = useCallback(() => {
    setIsLoading(true);
    refetch();
  }, [refetch]);
  
  return { tokens, isLoading: isLoading || isLoadingTokens, error, refresh };
};
