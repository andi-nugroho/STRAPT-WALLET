import { useState, useEffect, useCallback } from 'react';
import { useXellarWallet } from './use-xellar-wallet';

// Define the scheduled transfer type
export interface ScheduledTransfer {
  id: string;
  recipient: string;
  recipientName?: string;
  amount: string;
  token: string;
  scheduledDate: string; // ISO date string
  recurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: string; // ISO date string
}

// Mock scheduled transfers for fallback
const mockScheduledTransfers: ScheduledTransfer[] = [
  {
    id: '1',
    recipient: '0x1234...5678',
    recipientName: 'Sarah Miller',
    amount: '100',
    token: 'USDC',
    scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
    recurring: true,
    frequency: 'monthly',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    recipient: '0x9876...5432',
    recipientName: 'Alex Rodriguez',
    amount: '50',
    token: 'IDRX',
    scheduledDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
    recurring: false,
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    recipient: '0x6543...2109',
    recipientName: 'Jamie Smith',
    amount: '200',
    token: 'USDC',
    scheduledDate: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
    recurring: false,
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

// Local storage key
const SCHEDULED_TRANSFERS_STORAGE_KEY = 'strapt_scheduled_transfers';

/**
 * Hook to manage scheduled transfers
 */
export function useScheduledTransfers() {
  const [scheduledTransfers, setScheduledTransfers] = useState<ScheduledTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useXellarWallet();

  // Load scheduled transfers from local storage
  useEffect(() => {
    const loadScheduledTransfers = () => {
      if (!address) {
        setScheduledTransfers(mockScheduledTransfers);
        setIsLoading(false);
        return;
      }

      try {
        // Use a user-specific key to store scheduled transfers
        const storageKey = `${SCHEDULED_TRANSFERS_STORAGE_KEY}_${address}`;
        const storedTransfers = localStorage.getItem(storageKey);
        
        if (storedTransfers) {
          const parsedTransfers = JSON.parse(storedTransfers);
          setScheduledTransfers(parsedTransfers);
        } else {
          // If no stored transfers, use mock data
          setScheduledTransfers(mockScheduledTransfers);
        }
      } catch (error) {
        console.error('Error loading scheduled transfers:', error);
        setScheduledTransfers(mockScheduledTransfers);
      }
      
      setIsLoading(false);
    };

    loadScheduledTransfers();
  }, [address]);

  // Save scheduled transfers to local storage
  const saveScheduledTransfers = useCallback((updatedTransfers: ScheduledTransfer[]) => {
    if (!address) return;

    try {
      const storageKey = `${SCHEDULED_TRANSFERS_STORAGE_KEY}_${address}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedTransfers));
    } catch (error) {
      console.error('Error saving scheduled transfers:', error);
    }
  }, [address]);

  // Add a new scheduled transfer
  const addScheduledTransfer = useCallback((transfer: Omit<ScheduledTransfer, 'id' | 'createdAt' | 'status'>) => {
    if (!address) return;

    const newTransfer: ScheduledTransfer = {
      ...transfer,
      id: `transfer_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setScheduledTransfers(prevTransfers => {
      const updatedTransfers = [...prevTransfers, newTransfer];
      saveScheduledTransfers(updatedTransfers);
      return updatedTransfers;
    });
  }, [address, saveScheduledTransfers]);

  // Update an existing scheduled transfer
  const updateScheduledTransfer = useCallback((id: string, updates: Partial<ScheduledTransfer>) => {
    if (!address) return;

    setScheduledTransfers(prevTransfers => {
      const updatedTransfers = prevTransfers.map(transfer => 
        transfer.id === id ? { ...transfer, ...updates } : transfer
      );
      saveScheduledTransfers(updatedTransfers);
      return updatedTransfers;
    });
  }, [address, saveScheduledTransfers]);

  // Cancel a scheduled transfer
  const cancelScheduledTransfer = useCallback((id: string) => {
    if (!address) return;

    setScheduledTransfers(prevTransfers => {
      const updatedTransfers = prevTransfers.map(transfer => 
        transfer.id === id ? { ...transfer, status: 'cancelled' } : transfer
      );
      saveScheduledTransfers(updatedTransfers);
      return updatedTransfers;
    });
  }, [address, saveScheduledTransfers]);

  // Remove a scheduled transfer
  const removeScheduledTransfer = useCallback((id: string) => {
    if (!address) return;

    setScheduledTransfers(prevTransfers => {
      const updatedTransfers = prevTransfers.filter(transfer => transfer.id !== id);
      saveScheduledTransfers(updatedTransfers);
      return updatedTransfers;
    });
  }, [address, saveScheduledTransfers]);

  // Get pending scheduled transfers
  const getPendingTransfers = useCallback(() => {
    return scheduledTransfers.filter(transfer => transfer.status === 'pending');
  }, [scheduledTransfers]);

  // Get completed scheduled transfers
  const getCompletedTransfers = useCallback(() => {
    return scheduledTransfers.filter(transfer => transfer.status === 'completed');
  }, [scheduledTransfers]);

  return {
    scheduledTransfers,
    isLoading,
    addScheduledTransfer,
    updateScheduledTransfer,
    cancelScheduledTransfer,
    removeScheduledTransfer,
    getPendingTransfers,
    getCompletedTransfers
  };
}
