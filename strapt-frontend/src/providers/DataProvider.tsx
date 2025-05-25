import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDataServices, refreshAllData } from '@/services/DataService';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useLocation } from 'react-router-dom';

// Create context
interface DataContextType {
  isInitialized: boolean;
  refreshAllData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Provider component that initializes data services
 * and provides methods to refresh data
 */
export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { isConnected, address } = useXellarWallet();
  const location = useLocation();

  // Initialize data services when wallet is connected
  useEffect(() => {
    if (isConnected && address && !isInitialized) {
      console.log('Initializing data services with wallet:', address);
      try {
        initDataServices();
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing data services:', error);
      }
    }
  }, [isConnected, address, isInitialized]);

  // Refresh all data when wallet changes or route changes
  useEffect(() => {
    if (isConnected && address && isInitialized) {
      console.log('Wallet or route changed, refreshing all data');
      try {
        refreshAllData();
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }
  }, [address, isConnected, isInitialized, location.pathname]);

  // Set up window focus event listener
  useEffect(() => {
    const handleFocus = () => {
      if (isInitialized && isConnected && address) {
        console.log('Window focused, refreshing all data');
        try {
          refreshAllData();
        } catch (error) {
          console.error('Error refreshing data on window focus:', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isInitialized, isConnected, address]);

  // Set up online event listener
  useEffect(() => {
    const handleOnline = () => {
      if (isInitialized && isConnected && address) {
        console.log('Back online, refreshing all data');
        try {
          refreshAllData();
        } catch (error) {
          console.error('Error refreshing data on coming back online:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isInitialized, isConnected, address]);

  return (
    <DataContext.Provider value={{ isInitialized, refreshAllData }}>
      {children}
    </DataContext.Provider>
  );
};

/**
 * Hook to use the data context
 */
export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
