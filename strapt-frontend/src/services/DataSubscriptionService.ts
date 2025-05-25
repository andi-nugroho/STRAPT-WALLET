import { useEffect, useState } from 'react';

// Define types for data subscriptions
export type DataType =
  | 'tokens'
  | 'transfers'
  | 'streams'
  | 'drops'
  | 'claims'
  | 'profile'
  | 'balances';

// Generic type for data
export type DataRecord<T = unknown> = {
  data: T;
  timestamp: number;
};

export type DataSubscription<T = unknown> = {
  id: string;
  dataType: DataType;
  callback: (data: T) => void;
  refreshInterval?: number;
  lastUpdated?: number;
};

export type DataUpdate<T = unknown> = {
  dataType: DataType;
  data: T;
  timestamp: number;
};

// Global state for data subscriptions
const subscriptions = new Map<string, DataSubscription<unknown>>();
const dataCache = new Map<DataType, DataRecord<unknown>>();

// Default refresh intervals in milliseconds
const DEFAULT_REFRESH_INTERVALS: Record<DataType, number> = {
  tokens: 30000,      // 30 seconds
  transfers: 60000,   // 1 minute
  streams: 120000,    // 2 minutes
  drops: 120000,      // 2 minutes
  claims: 60000,      // 1 minute
  profile: 300000,    // 5 minutes
  balances: 30000,    // 30 seconds
};

// UI update intervals (for local updates without fetching)
const UI_UPDATE_INTERVALS: Record<DataType, number> = {
  tokens: 0,          // No local updates
  transfers: 0,       // No local updates
  streams: 5000,      // 5 seconds
  drops: 0,           // No local updates
  claims: 0,          // No local updates
  profile: 0,         // No local updates
  balances: 0,        // No local updates
};

// Flag to track if the service is initialized
let isInitialized = false;

/**
 * Initialize the data subscription service
 */
export const initDataSubscriptionService = () => {
  if (isInitialized) return;

  // Set up window focus event listener for refreshing data
  window.addEventListener('focus', () => {
    // Refresh all data types when window regains focus
    for (const dataType of Object.keys(DEFAULT_REFRESH_INTERVALS)) {
      refreshData(dataType as DataType);
    }
  });

  // Set up online event listener for refreshing data when reconnecting
  window.addEventListener('online', () => {
    // Refresh all data types when coming back online
    for (const dataType of Object.keys(DEFAULT_REFRESH_INTERVALS)) {
      refreshData(dataType as DataType);
    }
  });

  isInitialized = true;
};

/**
 * Subscribe to data updates
 * @param dataType The type of data to subscribe to
 * @param callback Function to call when data is updated
 * @param refreshInterval Optional custom refresh interval
 * @returns Subscription ID
 */
export const subscribeToData = <T = unknown>(
  dataType: DataType,
  callback: (data: T) => void,
  refreshInterval?: number
): string => {
  const subscriptionId = `${dataType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  subscriptions.set(subscriptionId, {
    id: subscriptionId,
    dataType,
    callback: callback as (data: unknown) => void, // Type cast for storage
    refreshInterval: refreshInterval || DEFAULT_REFRESH_INTERVALS[dataType],
    lastUpdated: Date.now(),
  });

  // Initialize service if not already initialized
  if (!isInitialized) {
    initDataSubscriptionService();
  }

  // If we have cached data for this type, immediately call the callback
  const cachedData = dataCache.get(dataType);
  if (cachedData) {
    callback(cachedData.data as T);
  }

  return subscriptionId;
};

/**
 * Unsubscribe from data updates
 * @param subscriptionId The subscription ID to unsubscribe
 */
export const unsubscribeFromData = (subscriptionId: string): void => {
  subscriptions.delete(subscriptionId);
};

/**
 * Update data for a specific type
 * @param dataType The type of data to update
 * @param data The new data
 */
export const updateData = <T = unknown>(dataType: DataType, data: T): void => {
  const timestamp = Date.now();

  // Update cache
  dataCache.set(dataType, { data: data as unknown, timestamp });

  // Notify all subscribers for this data type
  for (const subscription of subscriptions.values()) {
    if (subscription.dataType === dataType) {
      // Cast the callback to accept our data type
      (subscription.callback as (data: T) => void)(data);
      subscription.lastUpdated = timestamp;
    }
  }
};

// Variable to store the refresh handler function
let refreshHandler: ((dataType: DataType) => void) | null = null;

/**
 * Set the refresh handler function
 * This allows other modules to provide the implementation for refreshData
 * @param handler The function to call when refreshing data
 */
export const setRefreshHandler = (handler: (dataType: DataType) => void): void => {
  refreshHandler = handler;
};

/**
 * Refresh data for a specific type
 * This function will use the handler set by setRefreshHandler if available
 * @param dataType The type of data to refresh
 */
export const refreshData = (dataType: DataType): void => {
  if (refreshHandler) {
    // Use the custom handler if available
    refreshHandler(dataType);
  } else {
    // Default implementation (just logs)
    console.log(`Refreshing data for ${dataType} (no custom handler set)`);
  }
};

/**
 * Hook to subscribe to data updates
 * @param dataType The type of data to subscribe to
 * @param initialData Optional initial data
 * @param refreshInterval Optional custom refresh interval
 * @returns [data, isLoading, error, refresh]
 */
export const useDataSubscription = <T>(
  dataType: DataType,
  initialData?: T,
  refreshInterval?: number
): [T | null, boolean, Error | null, () => void] => {
  const [data, setData] = useState<T | null>(initialData || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Subscribe to data updates
    const subscriptionId = subscribeToData<T>(
      dataType,
      (newData) => {
        setData(newData);
        setIsLoading(false);
        setError(null);
      },
      refreshInterval
    );

    // Trigger initial data load
    try {
      refreshData(dataType);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }

    // Unsubscribe when component unmounts
    return () => {
      unsubscribeFromData(subscriptionId);
    };
  }, [dataType, refreshInterval]);

  // Function to manually refresh data
  const refresh = () => {
    setIsLoading(true);
    try {
      refreshData(dataType);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  };

  return [data, isLoading, error, refresh];
};
