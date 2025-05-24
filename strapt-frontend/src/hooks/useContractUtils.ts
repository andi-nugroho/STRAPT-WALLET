import { useState } from 'react';
import { useAccount } from 'wagmi';
import { writeContract, waitForTransactionReceipt, readContract, simulateContract, getAccount } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import { toast } from 'sonner';
import { TokenType, useTokenUtils } from './useTokenUtils';
import { useTransactionState } from './useTransactionState';
import { useErrorHandler } from './useErrorHandler';
import contractConfig from '@/contracts/contract-config.json';

/**
 * Hook for contract interaction utilities
 * Provides functions for token approvals, contract calls, and transaction handling
 */
export function useContractUtils() {
  const { address } = useAccount();
  const { getTokenAddress, getTokenDecimals, getTokenABI, parseTokenAmount } = useTokenUtils();
  const { handleError } = useErrorHandler();
  const { setIsApproving, setIsApproved } = useTransactionState();

  // Get contract address by name
  const getContractAddress = (contractName: string): `0x${string}` => {
    const contract = contractConfig[contractName];
    if (!contract || !contract.address) {
      throw new Error(`Contract ${contractName} not found in config`);
    }
    return contract.address as `0x${string}`;
  };

  // Check token allowance
  const checkAllowance = async (
    tokenType: TokenType,
    amount: string,
    ownerAddress: string,
    spenderContractName: string
  ): Promise<boolean> => {
    try {
      // Get token address and decimals
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);
      const spenderAddress = getContractAddress(spenderContractName);

      // Parse amount with correct decimals
      const parsedAmount = parseTokenAmount(amount, tokenType);

      // Get token ABI
      const tokenABI = getTokenABI(tokenType);

      // Check allowance
      const allowance = await readContract(config, {
        address: tokenAddress,
        abi: tokenABI,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, spenderAddress],
      }) as bigint;

      console.log(`Allowance for ${tokenType}: ${allowance.toString()}`);
      console.log(`Required amount: ${parsedAmount.toString()}`);

      return allowance >= parsedAmount;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  // Approve token for contract
  const approveToken = async (
    tokenType: TokenType,
    amount: string,
    spenderContractName: string
  ): Promise<boolean> => {
    try {
      setIsApproving(true);
      setIsApproved(false);

      // Check if wallet is connected
      if (!address) {
        toast.error("No wallet connected");
        return false;
      }

      // Get token address and ABI
      const tokenAddress = getTokenAddress(tokenType);
      const tokenABI = getTokenABI(tokenType);
      const spenderAddress = getContractAddress(spenderContractName);

      // Parse amount with correct decimals
      const parsedAmount = parseTokenAmount(amount, tokenType);

      // Approve token transfer
      const hash = await writeContract(config, {
        abi: tokenABI,
        functionName: 'approve',
        args: [spenderAddress, parsedAmount],
        address: tokenAddress,
        account: address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, {
        hash
      });

      if (receipt.status === 'success') {
        setIsApproved(true);
        toast.success("Token approval successful");
        return true;
      }

      toast.error("Token approval failed");
      return false;
    } catch (error) {
      handleError(error, "Failed to approve token");
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  // Execute a direct token transfer
  const executeDirectTokenTransfer = async (
    tokenType: TokenType,
    amount: string,
    recipient: string
  ): Promise<boolean> => {
    try {
      // Check if wallet is connected
      if (!address) {
        toast.error("No wallet connected");
        return false;
      }

      // Get token address and ABI
      const tokenAddress = getTokenAddress(tokenType);
      const tokenABI = getTokenABI(tokenType);

      // Parse amount with correct decimals
      const parsedAmount = parseTokenAmount(amount, tokenType);

      // Execute direct ERC20 transfer
      const hash = await writeContract(config, {
        abi: tokenABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, parsedAmount],
        address: tokenAddress,
        account: address,
        chain: config.chains[0], // Use the first chain in the config
      });

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, {
        hash
      });

      if (receipt.status === 'success') {
        toast.success("Direct transfer successful");
        return true;
      }

      toast.error("Direct transfer failed");
      return false;
    } catch (error) {
      handleError(error, "Direct transfer failed");
      return false;
    }
  };

  // Get expiry timestamp (current time + hours)
  const getExpiryTimestamp = (hours: number = 24): number => {
    return Math.floor(Date.now() / 1000) + (hours * 3600);
  };

  // Simulate contract call
  const simulateContractCall = async (
    contractName: string,
    functionName: string,
    args: any[]
  ) => {
    try {
      // Get the account
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      const contractAddress = getContractAddress(contractName);
      const contractABI = (await import(`@/contracts/${contractName}.json`)).default.abi;

      // Simulate the contract call
      const { request } = await simulateContract(config, {
        address: contractAddress,
        abi: contractABI,
        functionName,
        args,
        account: account.address,
      });

      return request;
    } catch (error) {
      handleError(error, `Failed to simulate ${functionName}`);
      throw error;
    }
  };

  return {
    getContractAddress,
    checkAllowance,
    approveToken,
    executeDirectTokenTransfer,
    getExpiryTimestamp,
    simulateContractCall,
  };
}
