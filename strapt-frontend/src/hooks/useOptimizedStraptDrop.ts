import { useState, useCallback, useMemo } from 'react';
import { parseUnits, decodeEventLog } from 'viem';
import { toast } from 'sonner';
import { readContract, simulateContract, writeContract, waitForTransactionReceipt, getAccount } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import StraptDropABI from '@/contracts/StraptDrop.json';
import contractConfig from '@/contracts/contract-config.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';
import { useXellarWallet } from './use-xellar-wallet';
import { useTokenBalances } from './use-token-balances';
import { useCachedContractRead } from './useCachedContractRead';

// Contract addresses from config
const STRAPT_DROP_ADDRESS = contractConfig.StraptDrop.address as `0x${string}`;
const USDC_ADDRESS = contractConfig.StraptDrop.supportedTokens.USDC as `0x${string}`;
const IDRX_ADDRESS = contractConfig.StraptDrop.supportedTokens.IDRX as `0x${string}`;

// Token types
export type TokenType = 'USDC' | 'IDRX';

// Drop info type
export interface DropInfo {
  creator: `0x${string}`;
  tokenAddress: `0x${string}`;
  totalAmount: bigint;
  remainingAmount: bigint;
  claimedCount: bigint;
  totalRecipients: bigint;
  amountPerRecipient: bigint;
  isRandom: boolean;
  expiryTime: bigint;
  message: string;
  isActive: boolean;
}

// Define interfaces for event args
interface EventArgs {
  [key: string]: unknown;
}

interface DropCreatedArgs extends EventArgs {
  dropId: `0x${string}`;
  creator: `0x${string}`;
  tokenAddress: `0x${string}`;
  totalAmount: bigint;
}

interface DropClaimedArgs extends EventArgs {
  dropId: `0x${string}`;
  claimer: `0x${string}`;
  amount: bigint;
}

// Cache for drop info to prevent redundant fetches
const dropInfoCache = new Map<string, { info: DropInfo; timestamp: number }>();
const CACHE_EXPIRY = 60000; // 1 minute

export function useOptimizedStraptDrop() {
  const [transactionState, setTransactionState] = useState({
    isLoading: false,
    isApproving: false,
    isCreating: false,
    isClaiming: false,
    isRefunding: false,
    isLoadingUserDrops: false,
    currentDropId: null as string | null,
  });
  
  // Use a single state object to reduce re-renders
  const [userDrops, setUserDrops] = useState<{id: string; info: DropInfo}[]>([]);
  const [tokenMetadata, setTokenMetadata] = useState<{
    symbols: {[key: string]: string},
    decimals: {[key: string]: number}
  }>({
    symbols: {},
    decimals: {}
  });
  
  const { address, isConnected } = useXellarWallet();
  const { tokens } = useTokenBalances();

  // Helper function to update transaction state
  const updateTransactionState = useCallback((updates: Partial<typeof transactionState>) => {
    setTransactionState(prev => ({ ...prev, ...updates }));
  }, []);

  // Helper function to get token address from token type - memoized
  const getTokenAddress = useCallback((tokenType: TokenType): `0x${string}` => {
    switch (tokenType) {
      case 'USDC': return USDC_ADDRESS;
      case 'IDRX': return IDRX_ADDRESS;
      default: throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }, []);

  // Helper function to get token decimals - memoized
  const getTokenDecimals = useCallback((tokenType: TokenType): number => {
    switch (tokenType) {
      case 'USDC': return 6;
      case 'IDRX': return 2;
      default: return 18;
    }
  }, []);

  // Get drop info with caching
  const getDropInfo = useCallback(async (dropId: string): Promise<DropInfo> => {
    // Check cache first
    const now = Date.now();
    const cachedData = dropInfoCache.get(dropId);
    
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY)) {
      return cachedData.info;
    }
    
    try {
      const result = await readContract(config, {
        address: STRAPT_DROP_ADDRESS,
        abi: StraptDropABI.abi,
        functionName: 'getDropInfo',
        args: [dropId as `0x${string}`],
      });

      const dropInfo: DropInfo = {
        creator: result[0] as `0x${string}`,
        tokenAddress: result[1] as `0x${string}`,
        totalAmount: result[2] as bigint,
        remainingAmount: result[3] as bigint,
        claimedCount: result[4] as bigint,
        totalRecipients: result[5] as bigint,
        isRandom: result[6] as boolean,
        expiryTime: result[7] as bigint,
        message: result[8] as string,
        isActive: result[9] as boolean,
        amountPerRecipient: result[6] ? 0n : (result[2] as bigint) / (result[5] as bigint), // Calculate if fixed distribution
      };
      
      // Update cache
      dropInfoCache.set(dropId, { info: dropInfo, timestamp: now });
      
      return dropInfo;
    } catch (error) {
      console.error('Error getting drop info:', error);
      throw error;
    }
  }, []);

  // Get all drops created by the user - optimized with caching and parallel processing
  const getUserCreatedDrops = useCallback(async (): Promise<{id: string; info: DropInfo}[]> => {
    try {
      updateTransactionState({ isLoadingUserDrops: true });

      if (!isConnected || !address) {
        console.error("No wallet connected");
        throw new Error("No wallet connected");
      }

      // Query past events to find drops created by this user
      console.log('Fetching drops created by:', address);

      // Use Lisk Sepolia Blockscout API to get events
      const blockscoutApiUrl = 'https://sepolia-blockscout.lisk.com/api';
      const contractAddress = STRAPT_DROP_ADDRESS;

      // Fetch events from Blockscout API
      const response = await fetch(
        `${blockscoutApiUrl}/v2/addresses/${contractAddress}/logs?topic0=0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch events from Blockscout API');
      }

      const eventsData = await response.json();
      
      // Filter events for this user's address
      const userEvents = eventsData.items.filter((event: any) => {
        try {
          const decodedData = decodeEventLog({
            abi: StraptDropABI.abi,
            data: event.data,
            topics: event.topics,
          });

          if (decodedData.eventName === 'DropCreated') {
            const args = decodedData.args as unknown as DropCreatedArgs;
            return args.creator.toLowerCase() === address.toLowerCase();
          }
          return false;
        } catch (e) {
          return false;
        }
      });

      // Process the events to get drop IDs and info in parallel
      const userDrops = await Promise.all(userEvents.map(async (event: any) => {
        try {
          const decodedData = decodeEventLog({
            abi: StraptDropABI.abi,
            data: event.data,
            topics: event.topics,
          });

          const args = decodedData.args as unknown as DropCreatedArgs;
          const dropId = args.dropId;

          // Get the drop info with caching
          const dropInfo = await getDropInfo(dropId);
          return { id: dropId, info: dropInfo };
        } catch (e) {
          console.error('Error processing drop event:', e);
          return null;
        }
      }));

      // Filter out null values
      const validDrops = userDrops.filter(drop => drop !== null) as {id: string; info: DropInfo}[];
      
      // Update token metadata for all drops
      const symbols: {[key: string]: string} = {};
      const decimals: {[key: string]: number} = {};

      for (const drop of validDrops) {
        const tokenAddress = drop.info.tokenAddress.toLowerCase();
        const idrxAddress = IDRX_ADDRESS.toLowerCase();
        const usdcAddress = USDC_ADDRESS.toLowerCase();

        if (tokenAddress === idrxAddress) {
          symbols[drop.id] = 'IDRX';
          decimals[drop.id] = 2;
        } else if (tokenAddress === usdcAddress) {
          symbols[drop.id] = 'USDC';
          decimals[drop.id] = 6;
        } else {
          symbols[drop.id] = 'Token';
          decimals[drop.id] = 18;
        }
      }

      // Update state
      setUserDrops(validDrops);
      setTokenMetadata({ symbols, decimals });
      
      return validDrops;
    } catch (error) {
      console.error('Error getting user created drops:', error);
      return [];
    } finally {
      updateTransactionState({ isLoadingUserDrops: false });
    }
  }, [address, isConnected, getDropInfo, updateTransactionState]);

  // Refund an expired drop
  const refundExpiredDrop = useCallback(async (dropId: string) => {
    try {
      updateTransactionState({ isLoading: true, isRefunding: true });

      if (!isConnected || !address) {
        toast.error("Please connect your wallet");
        throw new Error("No wallet connected");
      }

      toast.info('Refunding expired STRAPT Drop...');

      // Get the account
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Simulate the refund transaction
      const { request: refundRequest } = await simulateContract(config, {
        address: STRAPT_DROP_ADDRESS,
        abi: StraptDropABI.abi,
        functionName: 'refundExpiredDrop',
        args: [dropId as `0x${string}`],
        account: account.address,
      });

      // Send the refund transaction
      const refundHash = await writeContract(config, refundRequest);

      // Wait for refund transaction to be confirmed
      const refundReceipt = await waitForTransactionReceipt(config, { hash: refundHash });

      // Clear the cache for this drop
      dropInfoCache.delete(dropId);
      
      toast.success('Successfully refunded expired STRAPT Drop');
      return refundReceipt;
    } catch (error) {
      console.error('Error refunding drop:', error);
      throw error;
    } finally {
      updateTransactionState({ isLoading: false, isRefunding: false });
    }
  }, [address, isConnected, updateTransactionState]);

  // Memoized values and derived state
  const { 
    isLoading, isApproving, isCreating, isClaiming, isRefunding, isLoadingUserDrops, currentDropId 
  } = transactionState;

  return {
    // State
    isLoading,
    isApproving,
    isCreating,
    isClaiming,
    isRefunding,
    isLoadingUserDrops,
    currentDropId,
    userDrops,
    tokenMetadata,
    
    // Actions
    getUserCreatedDrops,
    refundExpiredDrop,
    getDropInfo,
    
    // Helpers
    getTokenAddress,
    getTokenDecimals,
    tokens
  };
}
