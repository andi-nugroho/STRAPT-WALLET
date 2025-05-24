import { create } from 'zustand';
import { useEffect, useCallback } from 'react';

// Types for modal state
interface ModalState {
  // Track active modals
  activeModals: Set<string>;

  // Track if a wallet transaction is in progress
  isTransactionInProgress: boolean;

  // Actions
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  setTransactionInProgress: (inProgress: boolean) => void;
}

// Create the store
export const useModalStore = create<ModalState>((set) => ({
  activeModals: new Set<string>(),
  isTransactionInProgress: false,

  openModal: (modalId: string) =>
    set((state) => {
      // Don't open new modals if a transaction is in progress
      if (state.isTransactionInProgress) {
        return state;
      }

      const newActiveModals = new Set(state.activeModals);
      newActiveModals.add(modalId);
      return { activeModals: newActiveModals };
    }),

  closeModal: (modalId: string) =>
    set((state) => {
      const newActiveModals = new Set(state.activeModals);
      newActiveModals.delete(modalId);
      return { activeModals: newActiveModals };
    }),

  closeAllModals: () =>
    set({ activeModals: new Set() }),

  setTransactionInProgress: (inProgress: boolean) =>
    set((state) => {
      // Only update if the state is actually changing
      if (inProgress === state.isTransactionInProgress) {
        return state;
      }

      // When a transaction starts, close all modals
      if (inProgress) {
        return {
          isTransactionInProgress: true,
          activeModals: new Set()
        };
      }

      return { isTransactionInProgress: false };
    }),
}));

/**
 * Hook to manage a specific modal with automatic closing during transactions
 * @param modalId Unique identifier for the modal
 * @param isOpen Current open state of the modal
 * @param onClose Function to call when the modal should close
 */
export function useModalManager(
  modalId: string,
  isOpen: boolean,
  onClose: () => void
) {
  const {
    activeModals,
    isTransactionInProgress,
    openModal,
    closeModal
  } = useModalStore();

  // Register modal when it opens
  useEffect(() => {
    if (isOpen) {
      openModal(modalId);
    } else {
      closeModal(modalId);
    }

    // Clean up when component unmounts
    return () => {
      closeModal(modalId);
    };
  }, [isOpen, modalId, openModal, closeModal]);

  // Close modal when transaction starts
  useEffect(() => {
    if (isTransactionInProgress && isOpen) {
      onClose();
    }
  }, [isTransactionInProgress, isOpen, onClose]);

  return {
    shouldBeOpen: isOpen && activeModals.has(modalId) && !isTransactionInProgress,
    isTransactionInProgress
  };
}

/**
 * Hook to detect and manage transaction confirmations
 * This should be used at the app level to detect when transactions are happening
 */
export function useTransactionDetector() {
  const { setTransactionInProgress, isTransactionInProgress } = useModalStore();

  // Function to start transaction mode (close all modals)
  const startTransaction = useCallback(() => {
    // Only set if not already in transaction mode
    if (!isTransactionInProgress) {
      setTransactionInProgress(true);
    }
  }, [isTransactionInProgress, setTransactionInProgress]);

  // Function to end transaction mode
  const endTransaction = useCallback(() => {
    // Only set if currently in transaction mode
    if (isTransactionInProgress) {
      setTransactionInProgress(false);
    }
  }, [isTransactionInProgress, setTransactionInProgress]);

  return {
    startTransaction,
    endTransaction,
    isTransactionInProgress
  };
}
