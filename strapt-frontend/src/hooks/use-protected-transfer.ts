/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Please use useProtectedTransferV2 from '@/hooks/use-protected-transfer-v2' instead.
 * This hook works with the old ProtectedTransfer contract which has been replaced by ProtectedTransferV2.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, formatUnits, keccak256, toBytes, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { writeContract, waitForTransactionReceipt } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import ProtectedTransferABI from '@/contracts/ProtectedTransfer.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';

// Contract addresses
const PROTECTED_TRANSFER_ADDRESS = ProtectedTransferABI.address as `0x${string}`;
const USDC_ADDRESS = USDCABI.address as `0x${string}`;
const IDRX_ADDRESS = IDRXABI.address as `0x${string}`;

// Token decimals
const USDC_DECIMALS = 6;
const IDRX_DECIMALS = 2;

// Token types
export type TokenType = 'USDC' | 'IDRX';

// Transfer status enum
export enum TransferStatus {
  Pending = 0,
  Claimed = 1,
  Refunded = 2
}

// Transfer type
export interface Transfer {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;       // Net amount after fee
  grossAmount: string;  // Original amount before fee
  expiry: number;
  status: TransferStatus;
  createdAt: number;
  isLinkTransfer: boolean;
}

export function useProtectedTransfer() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTransferId, setCurrentTransferId] = useState<string | null>(null);

  // Write contract hooks
  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Generate a random claim code
  const generateClaimCode = useCallback(() => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }, []);

  // Hash a claim code
  const hashClaimCode = useCallback((claimCode: string) => {
    return keccak256(toBytes(claimCode));
  }, []);

  // Get token address from token type
  const getTokenAddress = useCallback((tokenType: TokenType): `0x${string}` => {
    return tokenType === 'USDC' ? USDC_ADDRESS : IDRX_ADDRESS;
  }, []);

  // Get token decimals from token type
  const getTokenDecimals = useCallback((tokenType: TokenType): number => {
    return tokenType === 'USDC' ? USDC_DECIMALS : IDRX_DECIMALS;
  }, []);

  // Check token allowance
  const checkAllowance = async (
    tokenType: TokenType,
    amount: string,
    ownerAddress: string
  ): Promise<boolean> => {
    try {
      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Get token ABI
      const tokenABI = tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;

      // Import necessary functions
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/providers/XellarProvider');

      // Read allowance
      const allowance = await readContract(config, {
        abi: tokenABI,
        address: tokenAddress,
        functionName: 'allowance',
        args: [ownerAddress, PROTECTED_TRANSFER_ADDRESS],
      });

      console.log('Token allowance check:', {
        token: tokenType,
        allowance: allowance.toString(),
        required: parsedAmount.toString(),
        sufficient: BigInt(allowance) >= BigInt(parsedAmount)
      });

      // Return true if allowance is sufficient
      return BigInt(allowance) >= BigInt(parsedAmount);
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  // Create a transfer with claim code
  const createTransfer = async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
    customPassword: string | null = null,
  ) => {
    try {
      setIsLoading(true);

      // Use custom password if provided, otherwise generate a random one
      const claimCode = customPassword || generateClaimCode();
      const claimCodeHash = hashClaimCode(claimCode);

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp) ? expiryTimestamp : Math.floor(Date.now() / 1000) + 86400;
      console.log('Transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Skip token approval - it's already done in the TransferContext

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      // Log the arguments for debugging
      console.log('Preparing direct transfer with args:', {
        recipient,
        tokenAddress,
        parsedAmount: parsedAmount.toString(),
        expiryTimestamp: validExpiryTimestamp,
        claimCodeHash,
        account: account.address
      });

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        abi: ProtectedTransferABI.abi,
        address: PROTECTED_TRANSFER_ADDRESS,
        functionName: 'createTransfer',
        args: [recipient, tokenAddress, parsedAmount, BigInt(validExpiryTimestamp), claimCodeHash],
        account: account.address,
      });

      // Send the transaction - this will prompt the user to sign
      console.log('Sending transaction request:', request);
      const hash = await writeContractAction(config, request);
      console.log('Transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      console.log('Waiting for transaction receipt with hash:', hash);
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Transaction receipt received:', receipt);

      // Extract transfer ID from event logs
      let transferId = '';
      if (receipt?.logs) {
        console.log('Transaction logs:', receipt.logs);

        // Find the TransferCreated event and extract the transfer ID
        for (const log of receipt.logs) {
          try {
            console.log('Checking log:', log);
            console.log('Log topics:', log.topics);

            // The TransferCreated event signature
            // keccak256("TransferCreated(bytes32,address,address,address,uint256,uint256)")
            const transferCreatedSignature = '0xc01e8d8af68c8ec1e9a9ca9c29f9b4c5f8f8e26aec7917a8dbcbf812bcd7d2c3';

            // Check if this log is from our contract
            if (log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()) {
              console.log('Found log from our contract');

              // Check if this is the TransferCreated event
              if (log.topics[0] === transferCreatedSignature) {
                console.log('Found TransferCreated event');
                transferId = log.topics[1] as `0x${string}`;
                console.log('Extracted transfer ID:', transferId);
                break;
              }
            }
          } catch (e) {
            console.error('Error parsing log:', e);
          }
        }

        // If we still don't have a transfer ID, try a different approach
        if (!transferId) {
          console.log('Transfer ID not found in topics, trying to decode logs...');

          // Try to find any log from our contract
          const contractLogs = receipt.logs.filter(
            (log: { address: string; topics: string[] }) => log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()
          );

          if (contractLogs.length > 0) {
            console.log('Found logs from our contract:', contractLogs);

            // Just use the first log's first topic as the transfer ID if available
            if (contractLogs[0].topics.length > 1) {
              transferId = contractLogs[0].topics[1] as `0x${string}`;
              console.log('Using first topic as transfer ID:', transferId);
            }
            // If we still don't have a transfer ID, generate one from the transaction hash
            else if (hash) {
              // Use the transaction hash as a seed to generate a transfer ID
              transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
              console.log('Generated transfer ID from transaction hash:', transferId);
            }
          }
          // If we still don't have a transfer ID and we have a transaction hash, generate one from it
          else if (hash) {
            // Use the transaction hash as a seed to generate a transfer ID
            transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
            console.log('Generated transfer ID from transaction hash (no logs):', transferId);
          }
        }
      }

      // Set the current transfer ID
      if (transferId) {
        setCurrentTransferId(transferId);
      }

      // Return claim code and transfer ID
      return { claimCode, transferId: transferId || currentTransferId };
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error('Failed to create transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create a link transfer
  const createLinkTransfer = async (
    tokenType: TokenType,
    amount: string,
    expiryTimestamp: number,
  ) => {
    try {
      setIsLoading(true);

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp) ? expiryTimestamp : Math.floor(Date.now() / 1000) + 86400;
      console.log('Link transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');

      // Get account information
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      // Check if token is approved
      const isAllowanceSufficient = await checkAllowance(tokenType, amount, account.address);

      if (!isAllowanceSufficient) {
        console.error("Insufficient token allowance");
        throw new Error("Insufficient token allowance. Please approve the token first.");
      }

      // Prepare the transaction
      try {
        // Log the arguments for debugging
        console.log('Preparing link transfer with args:', {
          tokenAddress,
          parsedAmount: parsedAmount.toString(),
          expiryTimestamp: validExpiryTimestamp,
          account: account.address
        });

        // Import necessary functions from wagmi
        const { simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');

        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'createLinkTransfer',
          args: [tokenAddress, parsedAmount, BigInt(validExpiryTimestamp)],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        // Extract transfer ID from event logs
        let transferId = '';
        if (receipt?.logs) {
          console.log('Transaction logs:', receipt.logs);

          // Find the TransferCreated event and extract the transfer ID
          for (const log of receipt.logs) {
            try {
              console.log('Checking log:', log);
              console.log('Log topics:', log.topics);

              // The TransferCreated event signature
              // keccak256("TransferCreated(bytes32,address,address,address,uint256,uint256)")
              const transferCreatedSignature = '0xc01e8d8af68c8ec1e9a9ca9c29f9b4c5f8f8e26aec7917a8dbcbf812bcd7d2c3';

              // Check if this log is from our contract
              if (log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()) {
                console.log('Found log from our contract');

                // Check if this is the TransferCreated event
                if (log.topics[0] === transferCreatedSignature) {
                  console.log('Found TransferCreated event');
                  transferId = log.topics[1] as `0x${string}`;
                  console.log('Extracted transfer ID:', transferId);
                  break;
                }
              }
            } catch (e) {
              console.error('Error parsing log:', e);
            }
          }

          // If we still don't have a transfer ID, try a different approach
          if (!transferId) {
            console.log('Transfer ID not found in topics, trying to decode logs...');

            // Try to find any log from our contract
            const contractLogs = receipt.logs.filter(
              (log: { address: string; topics: string[] }) => log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()
            );

            if (contractLogs.length > 0) {
              console.log('Found logs from our contract:', contractLogs);

              // Just use the first log's first topic as the transfer ID if available
              if (contractLogs[0].topics.length > 1) {
                transferId = contractLogs[0].topics[1] as `0x${string}`;
                console.log('Using first topic as transfer ID:', transferId);
              }
              // If we still don't have a transfer ID, generate one from the transaction hash
              else if (hash) {
                // Use the transaction hash as a seed to generate a transfer ID
                transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
                console.log('Generated transfer ID from transaction hash:', transferId);
              }
            }
            // If we still don't have a transfer ID and we have a transaction hash, generate one from it
            else if (hash) {
              // Use the transaction hash as a seed to generate a transfer ID
              transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
              console.log('Generated transfer ID from transaction hash (no logs):', transferId);
            }
          }
        }

        // Set the current transfer ID
        if (transferId) {
          setCurrentTransferId(transferId);
        }

        // Return transfer ID
        return { transferId: transferId || currentTransferId };
      } catch (error) {
        console.error('Error in link transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          toast.error('Transaction cancelled', {
            description: 'You cancelled the transaction'
          });
          throw new Error('Transaction was rejected by the user');
        }

        // Check for common errors
        if (error.message && error.message.includes('insufficient funds')) {
          toast.error('Insufficient funds', {
            description: 'You do not have enough funds to complete this transaction'
          });
          throw new Error('Insufficient funds for transaction');
        }

        if (error.message && error.message.includes('gas required exceeds allowance')) {
          toast.error('Gas limit exceeded', {
            description: 'The transaction requires more gas than allowed'
          });
          throw new Error('Gas limit exceeded for transaction');
        }

        throw new Error(`Failed to create link transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error creating link transfer:', error);

      // Only show generic error if not already handled
      if (!error.message || (
          !error.message.includes('rejected by the user') &&
          !error.message.includes('Insufficient funds') &&
          !error.message.includes('Gas limit exceeded')
        )) {
        toast.error('Transfer failed', {
          description: 'Could not create transfer. Please try again.'
        });
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Claim a transfer with claim code
  const claimTransfer = async (
    transferId: string,
    claimCode: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      console.log('Claiming transfer with ID:', transferId, 'and claim code:', claimCode);

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'claimTransfer',
          args: [transferId as `0x${string}`, claimCode],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        return true;
      } catch (error) {
        console.error('Error in claim transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          toast.error('Transaction cancelled', {
            description: 'You cancelled the claim transaction'
          });
          throw new Error('Transaction was rejected by the user');
        }

        // Check for common errors
        if (error.message?.includes('insufficient funds')) {
          toast.error('Insufficient funds', {
            description: 'You do not have enough funds to pay for transaction fees'
          });
          throw new Error('Insufficient funds for transaction');
        }

        if (error.message?.includes('gas required exceeds allowance')) {
          toast.error('Gas limit exceeded', {
            description: 'The transaction requires more gas than allowed'
          });
          throw new Error('Gas limit exceeded for transaction');
        }

        // Check for invalid claim code
        if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
          toast.error('Invalid claim code', {
            description: 'The claim code you entered is incorrect'
          });
          throw new Error('Invalid claim code provided');
        }

        // Check for already claimed
        if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
          toast.error('Transfer not claimable', {
            description: 'This transfer has already been claimed or is not available'
          });
          throw new Error('Transfer not claimable');
        }

        throw new Error(`Failed to claim transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error claiming transfer:', error);

      // Only show generic error if not already handled
      if (!error.message || (
          !error.message.includes('rejected by the user') &&
          !error.message.includes('Insufficient funds') &&
          !error.message.includes('Gas limit exceeded') &&
          !error.message.includes('Invalid claim code') &&
          !error.message.includes('Transfer not claimable')
        )) {
        toast.error('Claim failed', {
          description: 'Could not claim transfer. Please try again.'
        });
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Claim a link transfer
  const claimLinkTransfer = async (
    transferId: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      console.log('Claiming link transfer with ID:', transferId);

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'claimLinkTransfer',
          args: [transferId as `0x${string}`],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        return true;
      } catch (error) {
        console.error('Error in claim link transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to claim link transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error claiming link transfer:', error);
      toast.error('Failed to claim link transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Refund a transfer
  const refundTransfer = async (
    transferId: string,
  ) => {
    try {
      setIsLoading(true);

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      console.log('Refunding transfer with ID:', transferId);

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'refundTransfer',
          args: [transferId as `0x${string}`],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        return true;
      } catch (error) {
        console.error('Error in refund transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to refund transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error refunding transfer:', error);
      toast.error('Failed to refund transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Define the transfer details type
  type TransferDetails = {
    sender: string;
    recipient: string;
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    grossAmount: string;
    expiry: number;
    status: number;
    createdAt: number;
    isLinkTransfer: boolean;
    id: string;
  };

  // Get transfer details
  const useTransferDetails = (transferId: string | null) => {
    const [transferData, setTransferData] = useState<TransferDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Use effect to fetch transfer details
    useEffect(() => {
      const fetchTransferDetails = async () => {
        if (!transferId) {
          setTransferData(null);
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          // Use the non-hook version to get transfer details
          const details = await getTransferDetails(transferId);
          setTransferData(details);
        } catch (err) {
          console.error('Error in useTransferDetails:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch transfer details'));
        } finally {
          setIsLoading(false);
        }
      };

      fetchTransferDetails();
    }, [transferId]);

    return {
      data: transferData,
      isLoading,
      error
    };
  };

  // Check if a transfer is claimable
  const useIsTransferClaimable = (transferId: string | null) => {
    return useReadContract({
      abi: ProtectedTransferABI.abi,
      address: PROTECTED_TRANSFER_ADDRESS,
      functionName: 'isTransferClaimable',
      args: transferId ? [transferId as `0x${string}`] : undefined,
      query: {
        enabled: !!transferId,
      }
    });
  };

  // Check if a transfer requires a password
  const isPasswordProtected = async (transferId: string) => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');
      const { createPublicClient, http } = await import('viem');
      const { liskSepolia } = await import('viem/chains');

      console.log('Checking if transfer is password protected:', transferId);

      // Create a low-level client to make a direct call to the contract
      // This bypasses some of the viem type checking that might be causing issues
      try {
        const publicClient = createPublicClient({
          chain: liskSepolia,
          transport: http('https://rpc.sepolia-api.lisk.com')
        });

        // Make a direct call to the contract's isPasswordProtected function
        const result = await publicClient.readContract({
          address: PROTECTED_TRANSFER_ADDRESS,
          abi: ProtectedTransferABI.abi,
          functionName: 'isPasswordProtected',
          args: [transferId as `0x${string}`],
        });

        console.log('isPasswordProtected direct call result:', result);

        // Convert the result to a boolean safely
        const isProtected = result === true || result === 1 || result === 1n;

        if (isProtected) {
          console.log('Transfer is password protected');
        } else {
          console.log('Transfer is NOT password protected');
        }

        return isProtected;
      } catch (directCallError) {
        console.error('Error with direct isPasswordProtected call:', directCallError);

        // Fall back to the standard readContract method
        console.log('Falling back to standard readContract method...');

        try {
          const isProtected = await readContract(config, {
            abi: ProtectedTransferABI.abi,
            address: PROTECTED_TRANSFER_ADDRESS,
            functionName: 'isPasswordProtected',
            args: [transferId as `0x${string}`],
          });

          console.log('isPasswordProtected fallback result:', isProtected);

          // Convert the result to a boolean safely
          const isProtectedBool = isProtected === true || isProtected === 1 || isProtected === 1n;

          if (isProtectedBool) {
            console.log('Transfer is password protected (fallback)');
          } else {
            console.log('Transfer is NOT password protected (fallback)');
          }

          return isProtectedBool;
        } catch (fallbackError) {
          console.error('Error with fallback isPasswordProtected call:', fallbackError);

          // Fallback to checking transfer details if both direct calls fail
          console.log('Falling back to checking transfer details...');

          try {
            // Get the transfer details to check if it has a claim code hash
            const transferDetails = await getTransferDetails(transferId);

            if (!transferDetails) {
              console.error('Transfer not found');
              return false;
            }

            console.log('Transfer details for password check:', transferDetails);

            // In the new contract, a transfer is password protected if:
            // 1. It's a regular transfer (not a link transfer) - these always require a password
            // 2. It's a protected link transfer - these have isLinkTransfer=true but require a password

            // We can't directly check the claimCodeHash from the frontend,
            // but we can infer from the transfer type and contract behavior

            if (transferDetails.isLinkTransfer) {
              // For link transfers, we need to check if it's a protected link transfer
              // Since we can't directly check claimCodeHash, we'll assume it's not password protected
              // This is a limitation of the current implementation
              console.log('This is a link transfer, assuming no password required (fallback logic)');
              return false;
            }

            // Regular transfers always require a password
            console.log('This is a regular transfer, password is required (fallback logic)');
            return true;
          } catch (detailsError) {
            console.error('Error getting transfer details:', detailsError);
            // If we can't get transfer details, default to requiring a password to be safe
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking if transfer is password protected:', error);
      // Default to requiring a password to be safe
      return true;
    }
  };

  // Get transfer details (non-hook version for use in functions)
  const getTransferDetails = async (transferId: string) => {
    try {
      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { readContract } = await import('wagmi/actions');
      const { createPublicClient, http } = await import('viem');
      const { liskSepolia } = await import('viem/chains');

      console.log('Getting transfer details for ID:', transferId);

      // Create a low-level client to make a direct call to the contract
      // This bypasses some of the viem type checking that might be causing issues
      try {
        const publicClient = createPublicClient({
          chain: liskSepolia,
          transport: http('https://rpc.sepolia-api.lisk.com')
        });

        // Make a direct call to the contract
        const result = await publicClient.readContract({
          address: PROTECTED_TRANSFER_ADDRESS,
          abi: ProtectedTransferABI.abi,
          functionName: 'getTransfer',
          args: [transferId as `0x${string}`],
        });

        console.log('Raw transfer data (direct call):', result);

        // Handle the result manually to avoid type issues
        if (!result || !Array.isArray(result) || result.length < 9) {
          console.error('Invalid result format:', result);
          return null;
        }

        // Extract values manually
        const [sender, recipient, tokenAddress, amount, grossAmount, expiry, status, createdAt, isLinkTransfer] = result;

        // Validate the data types
        if (
          typeof sender !== 'string' ||
          typeof recipient !== 'string' ||
          typeof tokenAddress !== 'string' ||
          typeof amount !== 'bigint' ||
          typeof grossAmount !== 'bigint' ||
          typeof expiry !== 'bigint'
        ) {
          console.error('Invalid data types in result:', result);
          return null;
        }

        // Determine token symbol based on token address
        let tokenSymbol = 'Unknown';
        if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          tokenSymbol = 'USDC';
        } else if (tokenAddress.toLowerCase() === IDRX_ADDRESS.toLowerCase()) {
          tokenSymbol = 'IDRX';
        }

        // Format amount based on token
        const decimals = tokenSymbol === 'USDC' ? USDC_DECIMALS : IDRX_DECIMALS;
        const formattedAmount = formatUnits(amount, decimals);
        const formattedGrossAmount = formatUnits(grossAmount, decimals);

        // Convert status to number safely
        const statusNumber = typeof status === 'bigint' ? Number(status) :
                            typeof status === 'number' ? status : 0;

        // Convert isLinkTransfer to boolean safely
        const isLinkTransferBool = isLinkTransfer === true || isLinkTransfer === 1 || isLinkTransfer === 1n;

        return {
          sender,
          recipient,
          tokenAddress,
          tokenSymbol,
          amount: formattedAmount,
          grossAmount: formattedGrossAmount,
          expiry: Number(expiry),
          status: statusNumber,
          createdAt: typeof createdAt === 'bigint' ? Number(createdAt) : 0,
          isLinkTransfer: isLinkTransferBool,
          id: transferId
        };
      } catch (directCallError) {
        console.error('Error with direct contract call:', directCallError);

        // Fall back to the standard readContract method
        console.log('Falling back to standard readContract method...');

        const data = await readContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'getTransfer',
          args: [transferId as `0x${string}`],
        });

        if (!data) return null;

        // Log the data for debugging
        console.log('Raw transfer data (fallback):', data);

        // Handle the data as an array without strict typing
        // We use unknown[] instead of any[] to be more type-safe
        const dataArray = data as unknown[];

        if (!Array.isArray(dataArray) || dataArray.length < 9) {
          console.error('Invalid data format:', dataArray);
          return null;
        }

        // Extract values manually
        const sender = dataArray[0] as string;
        const recipient = dataArray[1] as string;
        const tokenAddress = dataArray[2] as string;
        const amount = dataArray[3] as bigint;
        const grossAmount = dataArray[4] as bigint;
        const expiry = dataArray[5] as bigint;
        const status = dataArray[6]; // Don't cast this yet
        const createdAt = dataArray[7] as bigint;
        const isLinkTransfer = dataArray[8]; // Don't cast this yet

        // Determine token symbol based on token address
        let tokenSymbol = 'Unknown';
        if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          tokenSymbol = 'USDC';
        } else if (tokenAddress.toLowerCase() === IDRX_ADDRESS.toLowerCase()) {
          tokenSymbol = 'IDRX';
        }

        // Format amount based on token
        const decimals = tokenSymbol === 'USDC' ? USDC_DECIMALS : IDRX_DECIMALS;
        const formattedAmount = formatUnits(amount, decimals);
        const formattedGrossAmount = formatUnits(grossAmount, decimals);

        // Convert status to number safely
        const statusNumber = typeof status === 'bigint' ? Number(status) :
                            typeof status === 'number' ? status : 0;

        // Convert isLinkTransfer to boolean safely
        const isLinkTransferBool = isLinkTransfer === true || isLinkTransfer === 1 || isLinkTransfer === 1n;

        return {
          sender,
          recipient,
          tokenAddress,
          tokenSymbol,
          amount: formattedAmount,
          grossAmount: formattedGrossAmount,
          expiry: Number(expiry),
          status: statusNumber,
          createdAt: Number(createdAt),
          isLinkTransfer: isLinkTransferBool,
          id: transferId
        };
      }
    } catch (error) {
      console.error('Error getting transfer details:', error);
      return null;
    }
  };

  // Create a protected link transfer (with password protection)
  const createProtectedLinkTransfer = async (
    tokenType: TokenType,
    amount: string,
    claimCode: string,
    expiryTimestamp: number,
  ) => {
    try {
      setIsLoading(true);

      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseUnits(amount, decimals);

      // Ensure expiryTimestamp is a valid number
      const validExpiryTimestamp = typeof expiryTimestamp === 'number' && !Number.isNaN(expiryTimestamp) ? expiryTimestamp : Math.floor(Date.now() / 1000) + 86400;
      console.log('Protected link transfer expiry timestamp:', validExpiryTimestamp, 'current time:', Math.floor(Date.now() / 1000));

      // Import config for wagmi actions
      const { config } = await import('@/providers/XellarProvider');
      const { getAccount } = await import('wagmi/actions');

      // Get account information
      const account = getAccount(config);

      if (!account || !account.address) {
        console.error("No wallet connected or account is undefined");
        throw new Error("No wallet connected");
      }

      // Check if token is approved
      const isAllowanceSufficient = await checkAllowance(tokenType, amount, account.address);

      if (!isAllowanceSufficient) {
        console.error("Insufficient token allowance");
        throw new Error("Insufficient token allowance. Please approve the token first.");
      }

      // Hash the claim code
      const claimCodeHash = hashClaimCode(claimCode);
      console.log('Claim code hash:', claimCodeHash);

      // Prepare the transaction
      try {
        // Log the arguments for debugging
        console.log('Preparing protected link transfer with args:', {
          tokenAddress,
          parsedAmount: parsedAmount.toString(),
          expiryTimestamp: validExpiryTimestamp,
          claimCodeHash,
          account: account.address
        });

        // Import necessary functions from wagmi
        const { simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');

        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          abi: ProtectedTransferABI.abi,
          address: PROTECTED_TRANSFER_ADDRESS,
          functionName: 'createProtectedLinkTransfer',
          args: [tokenAddress, parsedAmount, BigInt(validExpiryTimestamp), claimCodeHash],
          account: account.address,
        });

        // Send the transaction - this will prompt the user to sign
        console.log('Sending transaction request:', request);
        const hash = await writeContractAction(config, request);
        console.log('Transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        console.log('Waiting for transaction receipt with hash:', hash);
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Transaction receipt received:', receipt);

        // Extract transfer ID from event logs
        let transferId = '';
        if (receipt?.logs) {
          console.log('Transaction logs:', receipt.logs);

          // Find the TransferCreated event and extract the transfer ID
          for (const log of receipt.logs) {
            try {
              console.log('Checking log:', log);
              console.log('Log topics:', log.topics);

              // The TransferCreated event signature
              // keccak256("TransferCreated(bytes32,address,address,address,uint256,uint256)")
              const transferCreatedSignature = '0xc01e8d8af68c8ec1e9a9ca9c29f9b4c5f8f8e26aec7917a8dbcbf812bcd7d2c3';

              // Check if this log is from our contract
              if (log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()) {
                console.log('Found log from our contract');

                // Check if this is the TransferCreated event
                if (log.topics[0] === transferCreatedSignature) {
                  console.log('Found TransferCreated event');
                  transferId = log.topics[1] as `0x${string}`;
                  console.log('Extracted transfer ID:', transferId);
                  break;
                }
              }
            } catch (e) {
              console.error('Error parsing log:', e);
            }
          }

          // If we still don't have a transfer ID, try a different approach
          if (!transferId) {
            console.log('Transfer ID not found in topics, trying to decode logs...');

            // Try to find any log from our contract
            const contractLogs = receipt.logs.filter(
              (log: { address: string; topics: string[] }) => log.address.toLowerCase() === PROTECTED_TRANSFER_ADDRESS.toLowerCase()
            );

            if (contractLogs.length > 0) {
              console.log('Found logs from our contract:', contractLogs);

              // Just use the first log's first topic as the transfer ID if available
              if (contractLogs[0].topics.length > 1) {
                transferId = contractLogs[0].topics[1] as `0x${string}`;
                console.log('Using first topic as transfer ID:', transferId);
              }
              // If we still don't have a transfer ID, generate one from the transaction hash
              else if (hash) {
                // Use the transaction hash as a seed to generate a transfer ID
                transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
                console.log('Generated transfer ID from transaction hash:', transferId);
              }
            }
            // If we still don't have a transfer ID and we have a transaction hash, generate one from it
            else if (hash) {
              // Use the transaction hash as a seed to generate a transfer ID
              transferId = `0x${hash.slice(2, 66)}` as `0x${string}`;
              console.log('Generated transfer ID from transaction hash (no logs):', transferId);
            }
          }
        }

        // Set the current transfer ID
        if (transferId) {
          setCurrentTransferId(transferId);
        }

        // Return transfer ID and claim code
        return { transferId: transferId || currentTransferId, claimCode };
      } catch (error) {
        console.error('Error in protected link transfer transaction:', error);
        // Check if it's a user rejection
        if (error.message && (
            error.message.includes('rejected') ||
            error.message.includes('denied') ||
            error.message.includes('cancelled') ||
            error.message.includes('canceled')
          )) {
          throw new Error('Transaction was rejected by the user');
        }
        throw new Error(`Failed to create protected link transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error creating protected link transfer:', error);
      toast.error('Failed to create protected link transfer');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading: isLoading || isPending || isConfirming,
    isConfirmed,
    createTransfer,
    createLinkTransfer,
    createProtectedLinkTransfer,
    claimTransfer,
    claimLinkTransfer,
    refundTransfer,
    useTransferDetails,
    useIsTransferClaimable,
    generateClaimCode,
    hashClaimCode,
    getTokenAddress,
    getTokenDecimals,
    checkAllowance,
    isPasswordProtected,
    getTransferDetails,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  };
}
