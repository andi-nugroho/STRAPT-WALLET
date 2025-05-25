import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { TokenOption } from '@/components/TokenSelect';
import { useProtectedTransferV2, TokenType } from '@/hooks/use-protected-transfer-v2';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { useAccount } from 'wagmi';

export type TransferType = 'direct' | 'claim';

// Define the transfer state structure
export interface TransferState {
  // Form state
  recipient: string;
  amount: string;
  note: string;
  withTimeout: boolean;
  withPassword: boolean;
  password: string;
  selectedToken: TokenOption | null;
  transferType: TransferType;
  transferLink: string;
  grossAmount: string;
  
  // Transaction state
  isLoading: boolean;
  isDirectTransferLoading: boolean;
  isConfirmed: boolean;
  isApproving: boolean;
  isApproved: boolean;
  claimCode: string;
  transferId: string | null;
}

// Define action types
export type TransferAction =
  | { type: 'SET_RECIPIENT'; payload: string }
  | { type: 'SET_AMOUNT'; payload: string }
  | { type: 'SET_NOTE'; payload: string }
  | { type: 'SET_WITH_TIMEOUT'; payload: boolean }
  | { type: 'SET_WITH_PASSWORD'; payload: boolean }
  | { type: 'SET_PASSWORD'; payload: string }
  | { type: 'SET_SELECTED_TOKEN'; payload: TokenOption | null }
  | { type: 'SET_TRANSFER_TYPE'; payload: TransferType }
  | { type: 'SET_TRANSFER_LINK'; payload: string }
  | { type: 'SET_GROSS_AMOUNT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DIRECT_TRANSFER_LOADING'; payload: boolean }
  | { type: 'SET_CONFIRMED'; payload: boolean }
  | { type: 'SET_APPROVING'; payload: boolean }
  | { type: 'SET_APPROVED'; payload: boolean }
  | { type: 'SET_CLAIM_CODE'; payload: string }
  | { type: 'SET_TRANSFER_ID'; payload: string | null }
  | { type: 'RESET_FORM' };

// Initial state
const initialState: TransferState = {
  recipient: '',
  amount: '',
  note: '',
  withTimeout: true,
  withPassword: true,
  password: '',
  selectedToken: null,
  transferType: 'claim',
  transferLink: '',
  grossAmount: '',
  
  isLoading: false,
  isDirectTransferLoading: false,
  isConfirmed: false,
  isApproving: false,
  isApproved: false,
  claimCode: '',
  transferId: null,
};

// Create reducer function
const transferReducer = (state: TransferState, action: TransferAction): TransferState => {
  switch (action.type) {
    case 'SET_RECIPIENT':
      return { ...state, recipient: action.payload };
    case 'SET_AMOUNT':
      return { ...state, amount: action.payload };
    case 'SET_NOTE':
      return { ...state, note: action.payload };
    case 'SET_WITH_TIMEOUT':
      return { ...state, withTimeout: action.payload };
    case 'SET_WITH_PASSWORD':
      return { ...state, withPassword: action.payload };
    case 'SET_PASSWORD':
      return { ...state, password: action.payload };
    case 'SET_SELECTED_TOKEN':
      return { ...state, selectedToken: action.payload };
    case 'SET_TRANSFER_TYPE':
      return { ...state, transferType: action.payload };
    case 'SET_TRANSFER_LINK':
      return { ...state, transferLink: action.payload };
    case 'SET_GROSS_AMOUNT':
      return { ...state, grossAmount: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_DIRECT_TRANSFER_LOADING':
      return { ...state, isDirectTransferLoading: action.payload };
    case 'SET_CONFIRMED':
      return { ...state, isConfirmed: action.payload };
    case 'SET_APPROVING':
      return { ...state, isApproving: action.payload };
    case 'SET_APPROVED':
      return { ...state, isApproved: action.payload };
    case 'SET_CLAIM_CODE':
      return { ...state, claimCode: action.payload };
    case 'SET_TRANSFER_ID':
      return { ...state, transferId: action.payload };
    case 'RESET_FORM':
      return {
        ...initialState,
        selectedToken: state.selectedToken, // Preserve selected token
      };
    default:
      return state;
  }
};

// Create context
interface TransferStateContextType {
  state: TransferState;
  dispatch: React.Dispatch<TransferAction>;
  // Helper functions
  formatTimeout: () => string;
  shortenTransferId: (id: string | null) => string;
  // Token data
  tokens: TokenOption[];
  isLoadingTokens: boolean;
  // Contract interaction functions
  createProtectedTransfer: () => Promise<boolean | undefined>;
  createProtectedLinkTransfer: () => Promise<boolean | undefined>;
  claimProtectedTransfer: (transferId: string, claimCode: string) => Promise<boolean>;
  claimProtectedLinkTransfer: (transferId: string) => Promise<boolean>;
  refundProtectedTransfer: (transferId: string) => Promise<boolean>;
  // Approval functions
  approveToken: () => Promise<boolean>;
}

const TransferStateContext = createContext<TransferStateContextType | undefined>(undefined);

// Create provider component
export const TransferStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(transferReducer, initialState);
  
  // Get account information
  const { address } = useAccount();
  
  // Get token balances
  const { tokens, isLoading: isLoadingTokens } = useTokenBalances();
  
  // Use the Protected Transfer V2 hook
  const {
    isLoading: isTransferLoading,
    isConfirmed,
    createDirectTransfer,
    createLinkTransfer,
    claimTransfer,
    refundTransfer,
    generateClaimCode,
    checkAllowance,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  } = useProtectedTransferV2();
  
  // Set initial selected token when tokens are loaded
  useEffect(() => {
    if (tokens.length > 0 && !state.selectedToken) {
      dispatch({ type: 'SET_SELECTED_TOKEN', payload: tokens[0] });
    }
  }, [tokens, state.selectedToken]);
  
  // Helper function to format timeout - always returns 24 hours
  const formatTimeout = () => {
    return "24 hours";
  };
  
  // Helper function to shorten transfer ID for display
  const shortenTransferId = (id: string | null) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };
  
  // Helper function to get token type from selected token
  const getTokenType = (): TokenType => {
    return (state.selectedToken?.symbol as TokenType) || 'IDRX';
  };
  
  // Helper function to get token address from selected token
  const getTokenAddress = (): `0x${string}` => {
    return state.selectedToken?.symbol === 'USDC' ? USDC_ADDRESS : IDRX_ADDRESS;
  };
  
  // Helper function to get expiry timestamp (24 hours from now)
  const getExpiryTimestamp = (): number => {
    return Math.floor(Date.now() / 1000) + 86400; // 24 hours in seconds
  };
  
  // Implementation of contract interaction functions
  // These would be implemented with the actual contract calls
  // For now, we'll just provide the function signatures
  
  // Create a protected transfer
  const createProtectedTransfer = async (): Promise<boolean | undefined> => {
    // Implementation would go here
    return true;
  };
  
  // Create a protected link transfer
  const createProtectedLinkTransfer = async (): Promise<boolean | undefined> => {
    // Implementation would go here
    return true;
  };
  
  // Claim a protected transfer
  const claimProtectedTransfer = async (transferId: string, claimCode: string): Promise<boolean> => {
    // Implementation would go here
    return true;
  };
  
  // Claim a protected link transfer
  const claimProtectedLinkTransfer = async (transferId: string): Promise<boolean> => {
    // Implementation would go here
    return true;
  };
  
  // Refund a protected transfer
  const refundProtectedTransfer = async (transferId: string): Promise<boolean> => {
    // Implementation would go here
    return true;
  };
  
  // Approve token for transfer
  const approveToken = async (): Promise<boolean> => {
    // Implementation would go here
    return true;
  };
  
  return (
    <TransferStateContext.Provider
      value={{
        state,
        dispatch,
        formatTimeout,
        shortenTransferId,
        tokens,
        isLoadingTokens,
        createProtectedTransfer,
        createProtectedLinkTransfer,
        claimProtectedTransfer,
        claimProtectedLinkTransfer,
        refundProtectedTransfer,
        approveToken,
      }}
    >
      {children}
    </TransferStateContext.Provider>
  );
};

// Create hook for using the context
export const useTransferState = () => {
  const context = useContext(TransferStateContext);
  if (context === undefined) {
    throw new Error('useTransferState must be used within a TransferStateProvider');
  }
  return context;
};
