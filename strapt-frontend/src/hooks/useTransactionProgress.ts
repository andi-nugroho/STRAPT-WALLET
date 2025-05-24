import { useState, useCallback } from 'react';
import { useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';

export type TransactionStatus = 'idle' | 'preparing' | 'simulating' | 'confirming' | 'confirmed' | 'failed';

export interface TransactionProgress {
  status: TransactionStatus;
  hash: `0x${string}` | null;
  error: string | null;
  progress: number;
}

export function useTransactionProgress() {
  const [progress, setProgress] = useState<TransactionProgress>({
    status: 'idle',
    hash: null,
    error: null,
    progress: 0
  });

  // Track transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: progress.hash || undefined
  });

  // Update progress
  const updateProgress = useCallback((updates: Partial<TransactionProgress>) => {
    setProgress(prev => ({ ...prev, ...updates }));
  }, []);

  // Start transaction
  const startTransaction = useCallback(() => {
    setProgress({
      status: 'preparing',
      hash: null,
      error: null,
      progress: 0
    });
  }, []);

  // Update status
  const updateStatus = useCallback((status: TransactionStatus) => {
    setProgress(prev => ({ ...prev, status }));
  }, []);

  // Set transaction hash
  const setHash = useCallback((hash: `0x${string}`) => {
    setProgress(prev => ({ ...prev, hash }));
  }, []);

  // Set error
  const setError = useCallback((error: string) => {
    setProgress(prev => ({ ...prev, error, status: 'failed' }));
    toast.error('Transaction failed', {
      description: error
    });
  }, []);

  // Complete transaction
  const completeTransaction = useCallback(() => {
    setProgress(prev => ({ ...prev, status: 'confirmed', progress: 100 }));
    toast.success('Transaction confirmed');
  }, []);

  // Reset progress
  const resetProgress = useCallback(() => {
    setProgress({
      status: 'idle',
      hash: null,
      error: null,
      progress: 0
    });
  }, []);

  // Update progress based on confirmation status
  if (progress.hash && isConfirming) {
    updateStatus('confirming');
  }

  if (progress.hash && isConfirmed) {
    completeTransaction();
  }

  return {
    progress,
    updateProgress,
    startTransaction,
    updateStatus,
    setHash,
    setError,
    completeTransaction,
    resetProgress,
    isConfirming,
    isConfirmed
  };
} 
