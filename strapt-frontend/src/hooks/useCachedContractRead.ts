import { useState, useEffect, useCallback, useRef } from 'react';
import { readContract } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import { useAccount } from 'wagmi';

// Cache storage for contract reads
const contractCache = new Map<string, { data: any; timestamp: number }>();

// Active requests tracker to prevent duplicate requests
const activeContractRequests = new Map<string, Promise<any>>();

// Default cache expiration time (30 seconds)
const DEFAULT_CACHE_TIME = 30 * 1000;

interface ContractReadOptions {
  contractAddress: `0x${string}`;
  abi: any;
  functionName: string;
  args?: any[];
  enabled?: boolean;
  cacheTime?: number;
  deduplicate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseCachedContractReadResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for contract data reading with caching and deduplication
 * @param options Contract read options
 * @returns Contract read result with data, error, loading state, and utility functions
 */
export function useCachedContractRead<T = any>(
  options: ContractReadOptions
): UseCachedContractReadResult<T> {
  const {
    contractAddress,
    abi,
    functionName,
    args = [],
    enabled = true,
    cacheTime = DEFAULT_CACHE_TIME,
    deduplicate = true,
    onSuccess,
    onError,
  } = options;

  const { isConnected } = useAccount();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Store the latest options in a ref to avoid unnecessary re-fetches
  const optionsRef = useRef({ cacheTime, onSuccess, onError });
  optionsRef.current = { cacheTime, onSuccess, onError };

  // Generate a cache key from the contract address, function name, and args
  const cacheKey = `${contractAddress}-${functionName}-${JSON.stringify(args)}`;

  // Function to fetch data from contract
  const fetchContractData = useCallback(async (skipCache = false): Promise<void> => {
    if (!enabled || !isConnected) return;

    // Check if we have a cached response
    if (!skipCache && contractCache.has(cacheKey)) {
      const cachedData = contractCache.get(cacheKey)!;
      const now = Date.now();

      // If the cache is still valid, use it
      if (now - cachedData.timestamp < optionsRef.current.cacheTime) {
        setData(cachedData.data);
        setIsLoading(false);
        optionsRef.current.onSuccess?.(cachedData.data);
        return;
      }
    }

    // Set loading state
    setIsLoading(true);
    setIsValidating(true);

    try {
      let responsePromise: Promise<any>;

      // Check if there's already an active request for this contract call
      if (deduplicate && activeContractRequests.has(cacheKey)) {
        responsePromise = activeContractRequests.get(cacheKey)!;
      } else {
        // Create a new request
        responsePromise = readContract(config, {
          address: contractAddress,
          abi,
          functionName,
          args,
        });

        // Store the promise if deduplication is enabled
        if (deduplicate) {
          activeContractRequests.set(cacheKey, responsePromise);
        }
      }

      // Wait for the response
      const responseData = await responsePromise;

      // Update the cache
      contractCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now(),
      });

      // Update state
      setData(responseData as T);
      setError(null);
      optionsRef.current.onSuccess?.(responseData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      optionsRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsValidating(false);

      // Remove from active requests
      if (deduplicate) {
        activeContractRequests.delete(cacheKey);
      }
    }
  }, [contractAddress, abi, functionName, args, enabled, isConnected, cacheKey, deduplicate]);

  // Initial fetch
  useEffect(() => {
    if (enabled && isConnected) {
      fetchContractData();
    }
  }, [enabled, isConnected, fetchContractData]);

  // Set up polling for contract data (every 15 seconds)
  useEffect(() => {
    if (!enabled || !isConnected) return;

    const intervalId = setInterval(() => {
      fetchContractData();
    }, 15000); // Poll every 15 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isConnected, fetchContractData]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    refetch: () => fetchContractData(true),
  };
}
