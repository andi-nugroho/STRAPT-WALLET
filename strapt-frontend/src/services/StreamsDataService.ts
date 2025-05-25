import { updateData, DataType } from './DataSubscriptionService';
import { usePaymentStream, Stream, StreamStatus } from '@/hooks/use-payment-stream';
import { useEffect, useState, useCallback } from 'react';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';

// Cache for streams data
let streamsCache: Stream[] = [];
let lastFetchTime = 0;
const FETCH_INTERVAL = 120000; // 2 minutes
const UI_UPDATE_INTERVAL = 5000; // 5 seconds

/**
 * Initialize the streams data service
 * This sets up the background fetching and updating of streams data
 */
export const initStreamsDataService = () => {
  // This will be called when the app starts
  console.log('Initializing streams data service');
  
  // Start the background refresh process
  startBackgroundRefresh();
};

/**
 * Start background refresh for streams data
 */
const startBackgroundRefresh = () => {
  // Set up interval to fetch streams data from blockchain
  setInterval(() => {
    fetchStreamsData();
  }, FETCH_INTERVAL);
  
  // Set up interval to update UI with calculated stream values
  setInterval(() => {
    updateStreamedAmounts();
  }, UI_UPDATE_INTERVAL);
};

/**
 * Fetch streams data from the blockchain
 */
export const fetchStreamsData = async () => {
  try {
    // Skip if we've fetched recently
    const now = Date.now();
    if (now - lastFetchTime < FETCH_INTERVAL) {
      return;
    }
    
    // We need to get the user's address and the payment stream hook
    // This is a bit tricky since we're outside of a component
    // In a real implementation, you might use a global state or singleton pattern
    
    // For now, we'll just update the timestamp and rely on the hook implementation
    lastFetchTime = now;
    
    // The actual fetching will happen in the hook
    // We'll just notify subscribers that they should refresh
    updateData('streams', streamsCache);
    
    console.log('Streams data fetched and updated');
  } catch (error) {
    console.error('Error fetching streams data:', error);
  }
};

/**
 * Update streamed amounts for active streams without fetching from blockchain
 */
const updateStreamedAmounts = () => {
  if (streamsCache.length === 0) return;
  
  const now = Math.floor(Date.now() / 1000);
  
  // Update streamed amounts for active streams
  const updatedStreams = streamsCache.map(stream => {
    // Only update active streams
    if (stream.status !== StreamStatus.Active) {
      return stream;
    }
    
    // Calculate new streamed amount based on time elapsed
    const startTime = stream.startTime;
    const endTime = stream.endTime;
    const totalAmount = Number(stream.amount);
    
    // If stream hasn't started yet or has ended, don't update
    if (now < startTime || now >= endTime) {
      return stream;
    }
    
    // Calculate elapsed time as a fraction of total duration
    const totalDuration = endTime - startTime;
    const elapsedDuration = Math.min(now - startTime, totalDuration);
    const elapsedFraction = elapsedDuration / totalDuration;
    
    // Calculate new streamed amount
    const newStreamed = (totalAmount * elapsedFraction).toFixed(6);
    
    // Update the stream with new streamed amount
    return {
      ...stream,
      streamed: newStreamed
    };
  });
  
  // Update cache and notify subscribers
  streamsCache = updatedStreams;
  updateData('streams', updatedStreams);
};

/**
 * Hook to use streams data with automatic updates
 * @returns [streams, isLoading, error, refetch]
 */
export const useStreamsData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useXellarWallet();
  const { useUserStreams } = usePaymentStream();
  const { streams, isLoading: isLoadingStreams, refetch } = useUserStreams(address);
  
  // Update the global cache when streams change
  useEffect(() => {
    if (!isLoadingStreams && streams) {
      streamsCache = streams;
      lastFetchTime = Date.now();
      updateData('streams', streams);
      setIsLoading(false);
    }
  }, [streams, isLoadingStreams]);
  
  // Set up interval to update UI with calculated stream values
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (streams.length > 0) {
        updateStreamedAmounts();
      }
    }, UI_UPDATE_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [streams]);
  
  // Function to manually refresh data
  const refresh = useCallback(() => {
    setIsLoading(true);
    refetch();
  }, [refetch]);
  
  return { streams, isLoading: isLoading || isLoadingStreams, error, refresh };
};
