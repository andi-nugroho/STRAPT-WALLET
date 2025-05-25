# STRAPT Frontend Refactoring

This document outlines the refactoring work done to make the STRAPT frontend code more modular, DRY, and clean.

## Table of Contents

1. [State Management](#state-management)
2. [Custom Hooks](#custom-hooks)
3. [Component Organization](#component-organization)
4. [Design System](#design-system)
5. [Usage Examples](#usage-examples)

## State Management

### AppStateContext

A centralized state management system using React Context API with TypeScript for type safety. This provides a global state store for the application, with slices for different parts of the application state.

```tsx
// Example usage
import { useUserState, useTokenState, useUIState } from '@/state/AppStateContext';

function MyComponent() {
  const { user, setAddress } = useUserState();
  const { tokens, setSelectedToken } = useTokenState();
  const { ui, setTheme } = useUIState();
  
  // Use state and actions
}
```

### TransferStateContext

A feature-specific state slice for transfers, providing state and actions related to transfers.

```tsx
// Example usage
import { useTransferState } from '@/state/TransferStateContext';

function TransferComponent() {
  const { 
    state, 
    dispatch, 
    createProtectedTransfer, 
    approveToken 
  } = useTransferState();
  
  // Use state and actions
}
```

## Custom Hooks

### useBaseContract

A base hook for contract interactions, providing common functionality for reading from and writing to contracts.

```tsx
// Example usage
import { useBaseContract } from '@/hooks/useBaseContract';

function ContractComponent() {
  const { 
    readFromContract, 
    writeToContract, 
    getContractEvents 
  } = useBaseContract();
  
  // Use contract functions
}
```

### useTokenUtils

A hook for token-related utilities, providing functions for token addresses, decimals, and validation.

```tsx
// Example usage
import { useTokenUtils } from '@/hooks/useTokenUtils';

function TokenComponent() {
  const { 
    getTokenAddress, 
    parseTokenAmount, 
    validateAmount 
  } = useTokenUtils();
  
  // Use token utilities
}
```

### useErrorHandler

A hook for standardized error handling, providing functions for handling different types of errors with appropriate toast messages.

```tsx
// Example usage
import { useErrorHandler } from '@/hooks/useErrorHandler';

function ErrorHandlingComponent() {
  const { handleError, handleFormError, handleApiError } = useErrorHandler();
  
  // Use error handling functions
}
```

### useTransactionState

A hook for managing transaction states, providing state variables and setters for loading, approving, confirming, etc.

```tsx
// Example usage
import { useTransactionState } from '@/hooks/useTransactionState';

function TransactionComponent() {
  const { 
    isLoading, 
    isConfirming, 
    resetStates 
  } = useTransactionState();
  
  // Use transaction state
}
```

### useClaimCodeUtils

A hook for claim code utilities, providing functions for generating and hashing claim codes.

```tsx
// Example usage
import { useClaimCodeUtils } from '@/hooks/useClaimCodeUtils';

function ClaimComponent() {
  const { 
    generateClaimCode, 
    hashClaimCode, 
    validateClaimCode 
  } = useClaimCodeUtils();
  
  // Use claim code utilities
}
```

### useContractUtils

A hook for contract interaction utilities, providing functions for token approvals, contract calls, and transaction handling.

```tsx
// Example usage
import { useContractUtils } from '@/hooks/useContractUtils';

function ContractComponent() {
  const { 
    getContractAddress, 
    checkAllowance, 
    approveToken 
  } = useContractUtils();
  
  // Use contract utilities
}
```

## Component Organization

Components are organized by function:

- **Layout Components**: Components that define the structure of the page (e.g., `Layout`, `DesktopLayout`)
- **Form Components**: Components for user input (e.g., `RecipientDetailsForm`, `ProtectionOptionsForm`)
- **Display Components**: Components for displaying data (e.g., `TransferSuccessView`, `QRCode`)
- **UI Components**: Reusable UI elements (e.g., `Button`, `Card`, `Input`)

## Design System

The design system is based on shadcn/ui components with custom styling. It includes:

- **Design Tokens**: Colors, spacing, typography
- **Component Library**: Consistent styling and behavior
- **Accessibility Features**: Ensuring all components are accessible

## Usage Examples

### Using the State Management System

```tsx
import { useUserState } from '@/state/AppStateContext';
import { useTransferState } from '@/state/TransferStateContext';

function MyComponent() {
  const { user } = useUserState();
  const { state, createProtectedTransfer } = useTransferState();
  
  const handleTransfer = async () => {
    if (user.isConnected) {
      await createProtectedTransfer();
    }
  };
  
  return (
    <div>
      <h1>Hello, {user.address}</h1>
      <button onClick={handleTransfer}>Transfer</button>
    </div>
  );
}
```

### Using the Custom Hooks

```tsx
import { useTokenUtils } from '@/hooks/useTokenUtils';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useTransactionState } from '@/hooks/useTransactionState';

function TokenTransferComponent() {
  const { validateAmount, parseTokenAmount } = useTokenUtils();
  const { handleError } = useErrorHandler();
  const { isLoading, setIsLoading } = useTransactionState();
  
  const handleTransfer = async (amount: string, tokenBalance: number) => {
    try {
      setIsLoading(true);
      
      // Validate amount
      if (!validateAmount(amount, tokenBalance, 'USDC')) {
        return;
      }
      
      // Parse amount
      const parsedAmount = parseTokenAmount(amount, 'USDC');
      
      // Execute transfer
      // ...
    } catch (error) {
      handleError(error, 'Transfer failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <button 
        onClick={() => handleTransfer('100', 1000)} 
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Transfer'}
      </button>
    </div>
  );
}
```
