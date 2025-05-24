import { useState, useCallback } from 'react';
import { 
  readContract, 
  writeContract, 
  waitForTransactionReceipt, 
  simulateContract, 
  getAccount 
} from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import contractConfig from '@/contracts/contract-config.json';

// Define types for contract interaction
export interface ContractCallOptions {
  contractName: string;
  functionName: string;
  args: any[];
  value?: bigint;
}

export interface ContractReadOptions extends ContractCallOptions {
  enabled?: boolean;
}

export interface ContractEventOptions {
  contractName: string;
  eventName: string;
  fromBlock?: bigint;
  toBlock?: bigint | 'latest';
  args?: any[];
}

/**
 * Base hook for contract interactions
 * Provides common functionality for reading from and writing to contracts
 */
export function useBaseContract() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  /**
   * Get contract address by name
   * @param contractName Name of the contract in the config
   * @returns Contract address as 0x string
   */
  const getContractAddress = useCallback((contractName: string): `0x${string}` => {
    const contract = contractConfig[contractName];
    if (!contract || !contract.address) {
      throw new Error(`Contract ${contractName} not found in config`);
    }
    return contract.address as `0x${string}`;
  }, []);

  /**
   * Get contract ABI by name
   * @param contractName Name of the contract
   * @returns Contract ABI
   */
  const getContractABI = useCallback(async (contractName: string) => {
    try {
      const contractABI = (await import(`@/contracts/${contractName}.json`)).default.abi;
      return contractABI;
    } catch (error) {
      console.error(`Error loading ABI for ${contractName}:`, error);
      throw new Error(`Failed to load ABI for ${contractName}`);
    }
  }, []);

  /**
   * Reset state
   */
  const resetState = useCallback(() => {
    setIsLoading(false);
    setIsError(false);
    setErrorMessage(null);
    setTransactionHash(null);
    setIsConfirming(false);
    setIsConfirmed(false);
  }, []);

  /**
   * Handle errors
   * @param error Error object
   * @param defaultMessage Default error message
   */
  const handleError = useCallback((error: any, defaultMessage: string = 'Transaction failed') => {
    console.error('Contract error:', error);
    setIsError(true);
    
    // Extract error message
    const errorMessage = error?.message || String(error);
    setErrorMessage(errorMessage);
    
    // Show toast with error message
    if (errorMessage.includes('rejected') || errorMessage.includes('denied') || errorMessage.includes('cancelled')) {
      toast.error('Transaction cancelled', {
        description: 'You cancelled the transaction'
      });
    } else {
      toast.error(defaultMessage, {
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
      });
    }
  }, []);

  /**
   * Read data from a contract
   * @param options Contract read options
   * @returns Promise with the read result
   */
  const readFromContract = useCallback(async <T>(options: ContractReadOptions): Promise<T | null> => {
    try {
      const { contractName, functionName, args, enabled = true } = options;
      
      if (!enabled) {
        return null;
      }
      
      const contractAddress = getContractAddress(contractName);
      const contractABI = await getContractABI(contractName);
      
      const result = await readContract(config, {
        address: contractAddress,
        abi: contractABI,
        functionName,
        args,
      }) as T;
      
      return result;
    } catch (error) {
      handleError(error, `Failed to read from ${options.contractName}`);
      return null;
    }
  }, [getContractAddress, getContractABI, handleError]);

  /**
   * Write to a contract
   * @param options Contract call options
   * @returns Promise with the transaction hash
   */
  const writeToContract = useCallback(async (options: ContractCallOptions): Promise<`0x${string}` | null> => {
    try {
      resetState();
      setIsLoading(true);
      
      if (!isConnected || !address) {
        toast.error('No wallet connected');
        throw new Error('No wallet connected');
      }
      
      const { contractName, functionName, args, value } = options;
      const contractAddress = getContractAddress(contractName);
      const contractABI = await getContractABI(contractName);
      
      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: contractAddress,
        abi: contractABI,
        functionName,
        args,
        account: address,
        value,
      });
      
      // Send the transaction
      const hash = await writeContract(config, request);
      setTransactionHash(hash);
      
      // Wait for confirmation
      setIsConfirming(true);
      const receipt = await waitForTransactionReceipt(config, { hash });
      setIsConfirming(false);
      
      if (receipt.status === 'success') {
        setIsConfirmed(true);
        toast.success('Transaction confirmed');
        return hash;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      handleError(error, `Failed to write to ${options.contractName}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, getContractAddress, getContractABI, handleError, resetState]);

  /**
   * Get events from a contract
   * @param options Contract event options
   * @returns Promise with the events
   */
  const getContractEvents = useCallback(async <T>(options: ContractEventOptions): Promise<T[]> => {
    try {
      const { contractName, eventName, fromBlock = BigInt(0), toBlock = 'latest', args } = options;
      
      // This is a simplified implementation
      // In a real app, you would use a provider to get logs and decode them
      console.log(`Getting ${eventName} events from ${contractName}`);
      
      // Return empty array for now
      return [] as T[];
    } catch (error) {
      handleError(error, `Failed to get events from ${options.contractName}`);
      return [];
    }
  }, [handleError]);

  return {
    // State
    isLoading,
    isError,
    errorMessage,
    transactionHash,
    isConfirming,
    isConfirmed,
    
    // Methods
    getContractAddress,
    getContractABI,
    readFromContract,
    writeToContract,
    getContractEvents,
    resetState,
    handleError,
  };
}
