import { useState, useEffect, useRef, useCallback } from 'react';

// Cache storage for requests
const cache = new Map<string, { data: any; timestamp: number }>();

// Active requests tracker to prevent duplicate requests
const activeRequests = new Map<string, Promise<any>>();

// Default cache expiration time (5 minutes)
const DEFAULT_CACHE_TIME = 5 * 60 * 1000;

interface UseCachedFetchOptions {
  cacheTime?: number;
  deduplicate?: boolean;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (newData?: T) => void;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for data fetching with caching and deduplication
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns Fetch result with data, error, loading state, and utility functions
 */
export function useCachedFetch<T = any>(
  url: string | null,
  options: UseCachedFetchOptions = {}
): UseCachedFetchResult<T> {
  const {
    cacheTime = DEFAULT_CACHE_TIME,
    deduplicate = true,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Store the latest options in a ref to avoid unnecessary re-fetches
  const optionsRef = useRef({ cacheTime, onSuccess, onError });
  optionsRef.current = { cacheTime, onSuccess, onError };

  // Generate a cache key from the URL
  const cacheKey = url || '';

  // Function to fetch data
  const fetchData = useCallback(async (skipCache = false): Promise<void> => {
    if (!url) return;

    // Check if we have a cached response
    if (!skipCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey)!;
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

      // Check if there's already an active request for this URL
      if (deduplicate && activeRequests.has(cacheKey)) {
        responsePromise = activeRequests.get(cacheKey)!;
      } else {
        // Create a new request
        responsePromise = fetch(url).then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        });

        // Store the promise if deduplication is enabled
        if (deduplicate) {
          activeRequests.set(cacheKey, responsePromise);
        }
      }

      // Wait for the response
      const responseData = await responsePromise;

      // Update the cache
      cache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now(),
      });

      // Update state
      setData(responseData);
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
        activeRequests.delete(cacheKey);
      }
    }
  }, [url, cacheKey, deduplicate]);

  // Function to manually update the data
  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
      cache.set(cacheKey, {
        data: newData,
        timestamp: Date.now(),
      });
    } else {
      // If no new data is provided, refetch
      fetchData(true);
    }
  }, [cacheKey, fetchData]);

  // Initial fetch
  useEffect(() => {
    if (url) {
      fetchData();
    }
  }, [url, fetchData]);

  // Set up revalidation on window focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      if (url) {
        setIsValidating(true);
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [url, fetchData, revalidateOnFocus]);

  // Set up revalidation on network reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return;

    const handleOnline = () => {
      if (url) {
        setIsValidating(true);
        fetchData();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [url, fetchData, revalidateOnReconnect]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refetch: () => fetchData(true),
  };
}
