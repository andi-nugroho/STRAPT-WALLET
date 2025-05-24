import React, { useEffect, useRef } from 'react';
import { useModalStore } from '@/hooks/use-modal-manager';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

/**
 * Component that detects when a transaction is being confirmed
 * and closes all modals when that happens
 */
const TransactionDetector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get the setTransactionInProgress function directly from the store
  const setTransactionInProgress = useModalStore(state => state.setTransactionInProgress);

  // Get transaction state from wagmi
  const { isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt();

  // Use refs to track previous state to prevent unnecessary updates
  const prevTransactionStateRef = useRef<boolean>(false);

  // Detect when a transaction is in progress
  useEffect(() => {
    const isInProgress = isPending || isConfirming;

    // Only update if the state has actually changed
    if (isInProgress !== prevTransactionStateRef.current) {
      prevTransactionStateRef.current = isInProgress;
      setTransactionInProgress(isInProgress);
    }
  }, [isPending, isConfirming, setTransactionInProgress]);

  // Create ref outside of useEffect
  const dialogVisibleRef = useRef<boolean>(false);

  // Add a global event listener for Xellar wallet events
  useEffect(() => {
    // Function to detect if an element is a wallet confirmation dialog
    const isWalletConfirmationDialog = (element: Element): boolean => {
      // Check for Xellar wallet dialog
      return (
        element.tagName === 'DIV' &&
        (
          element.classList.contains('xellar-modal') ||
          element.getAttribute('data-xellar-modal') === 'true' ||
          (element.getAttribute('role') === 'dialog' &&
           element.innerHTML.includes('Confirm Transaction'))
        )
      );
    };

    // Check if a wallet dialog exists in the DOM
    const checkForWalletDialog = () => {
      const existingDialog = document.querySelector('[data-xellar-modal="true"]') ||
                            document.querySelector('.xellar-modal');

      return !!existingDialog;
    };

    // Mutation observer to detect when wallet confirmation appears
    const observer = new MutationObserver(() => {
      const dialogExists = checkForWalletDialog();

      // Only update state if there's a change
      if (dialogExists && !dialogVisibleRef.current) {
        dialogVisibleRef.current = true;
        setTransactionInProgress(true);
      } else if (!dialogExists && dialogVisibleRef.current) {
        dialogVisibleRef.current = false;
        // Wait a bit before ending transaction mode
        setTimeout(() => {
          setTransactionInProgress(false);
        }, 500);
      }
    });

    // Start observing the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Clean up observer on unmount
    return () => {
      observer.disconnect();
    };
  }, [setTransactionInProgress]);

  return <>{children}</>;
};

export default TransactionDetector;
