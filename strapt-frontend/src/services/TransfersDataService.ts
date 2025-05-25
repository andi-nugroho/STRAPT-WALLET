import { updateData } from './DataSubscriptionService';
import { useProtectedTransferV2, TransferDetails } from '@/hooks/use-protected-transfer-v2';
import { useEffect, useState, useCallback } from 'react';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';

// Cache for transfers data
let sentTransfersCache: TransferDetails[] = [];
let receivedTransfersCache: TransferDetails[] = [];
let lastFetchTime = 0;
const FETCH_INTERVAL = 60000; // 1 minute

/**
 * Initialize the transfers data service
 */
export const initTransfersDataService = () => {
  console.log('Initializing transfers data service');
  
  // Start the background refresh process
  startBackgroundRefresh();
};

/**
 * Start background refresh for transfers data
 */
const startBackgroundRefresh = () => {
  // Set up interval to fetch transfers data
  setInterval(() => {
    fetchTransfersData();
  }, FETCH_INTERVAL);
};

/**
 * Fetch transfers data
 */
export const fetchTransfersData = async () => {
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
    updateData('transfers', {
      sent: sentTransfersCache,
      received: receivedTransfersCache
    });
    
    console.log('Transfers data updated');
  } catch (error) {
    console.error('Error fetching transfers data:', error);
  }
};

/**
 * Hook to use sent transfers with automatic updates
 */
export const useSentTransfersData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useXellarWallet();
  const { getSentTransfers } = useProtectedTransferV2();
  const [transfers, setTransfers] = useState<TransferDetails[]>([]);
  
  // Fetch sent transfers
  const fetchSentTransfers = useCallback(async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      const result = await getSentTransfers();
      setTransfers(result);
      sentTransfersCache = result;
      updateData('transfers', {
        sent: result,
        received: receivedTransfersCache
      });
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [address, getSentTransfers]);
  
  // Fetch on mount and when address changes
  useEffect(() => {
    fetchSentTransfers();
    
    // Set up interval to refresh
    const intervalId = setInterval(() => {
      fetchSentTransfers();
    }, FETCH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [fetchSentTransfers]);
  
  return { transfers, isLoading, error, refresh: fetchSentTransfers };
};

/**
 * Hook to use received transfers with automatic updates
 */
export const useReceivedTransfersData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useXellarWallet();
  const { getReceivedTransfers } = useProtectedTransferV2();
  const [transfers, setTransfers] = useState<TransferDetails[]>([]);
  
  // Fetch received transfers
  const fetchReceivedTransfers = useCallback(async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      const result = await getReceivedTransfers();
      setTransfers(result);
      receivedTransfersCache = result;
      updateData('transfers', {
        sent: sentTransfersCache,
        received: result
      });
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [address, getReceivedTransfers]);
  
  // Fetch on mount and when address changes
  useEffect(() => {
    fetchReceivedTransfers();
    
    // Set up interval to refresh
    const intervalId = setInterval(() => {
      fetchReceivedTransfers();
    }, FETCH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [fetchReceivedTransfers]);
  
  return { transfers, isLoading, error, refresh: fetchReceivedTransfers };
};
