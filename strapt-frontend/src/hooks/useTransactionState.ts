import { useState, useCallback, useRef } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

/**
 * Hook for managing transaction states
 * Provides state variables and setters for loading, approving, confirming, etc.
 */
export function useTransactionState() {
  // Common transaction states
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  // Transaction queue management
  const transactionQueue = useRef<Array<() => Promise<void>>>([]);
  const isProcessing = useRef(false);

  // Write contract hooks from wagmi
  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Process next transaction in queue
  const processNextTransaction = useCallback(async () => {
    if (isProcessing.current || transactionQueue.current.length === 0) {
      return;
    }

    isProcessing.current = true;
    const nextTransaction = transactionQueue.current.shift();

    try {
      if (nextTransaction) {
        await nextTransaction();
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
    } finally {
      isProcessing.current = false;
      processNextTransaction();
    }
  }, []);

  // Add transaction to queue
  const queueTransaction = useCallback((transaction: () => Promise<void>) => {
    transactionQueue.current.push(transaction);
    processNextTransaction();
  }, [processNextTransaction]);

  // Reset all states
  const resetStates = useCallback(() => {
    setIsLoading(false);
    setIsApproving(false);
    setIsApproved(false);
    setIsCreating(false);
    setIsClaiming(false);
    setIsRefunding(false);
    transactionQueue.current = [];
    isProcessing.current = false;
  }, []);

  // Shorten ID for display
  const shortenId = (id: string | null) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  return {
    // State variables
    isLoading,
    setIsLoading,
    isApproving,
    setIsApproving,
    isApproved,
    setIsApproved,
    isCreating,
    setIsCreating,
    isClaiming,
    setIsClaiming,
    isRefunding,
    setIsRefunding,
    currentId,
    setCurrentId,
    
    // Wagmi hooks
    writeContract,
    isPending,
    hash,
    isConfirming,
    isConfirmed,
    
    // Utility functions
    resetStates,
    shortenId,
    queueTransaction,
    
    // Computed states
    isProcessing: isLoading || isPending || isConfirming || isApproving || isCreating || isClaiming || isRefunding || isProcessing.current,
  };
}
