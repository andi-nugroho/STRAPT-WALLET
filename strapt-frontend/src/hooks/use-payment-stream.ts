import { useState, useCallback, useMemo, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, keccak256, toBytes, decodeEventLog, AbiEventLog } from 'viem';
import { toast } from 'sonner';
import { writeContract, waitForTransactionReceipt, readContract } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import PaymentStreamABI from '@/contracts/PaymentStream.json';
import contractConfig from '@/contracts/contract-config.json';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';
import { useXellarWallet } from './use-xellar-wallet';
import { liskSepolia } from 'viem/chains';

// Define token types
export type TokenType = 'USDC' | 'IDRX';

// Define stream status enum to match contract
export enum StreamStatus {
  Active = 0,
  Paused = 1,
  Completed = 2,
  Canceled = 3
}

// Define milestone type
export interface Milestone {
  percentage: number;
  description: string;
  released: boolean;
}

// Define stream type
export interface Stream {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: TokenType;
  amount: string;
  streamed: string;
  startTime: number;
  endTime: number;
  status: StreamStatus;
  milestones: Milestone[];
}

// Get contract address from config
const PAYMENT_STREAM_ADDRESS = contractConfig.PaymentStream.address as `0x${string}`;

// Token addresses
const USDC_ADDRESS = contractConfig.PaymentStream.supportedTokens.USDC as `0x${string}`;
const IDRX_ADDRESS = contractConfig.PaymentStream.supportedTokens.IDRX as `0x${string}`;

// Create a cache for stream data to reduce RPC calls
const streamCache = new Map<string, { data: Stream; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes cache TTL (increased from 1 minute)
const STREAM_FETCH_INTERVAL = 120000; // 2 minutes between stream updates (increased from 30 seconds)
const UI_UPDATE_INTERVAL = 5000; // 5 seconds between UI updates
let lastRpcCallTime = 0;
const RPC_RATE_LIMIT = 1000; // Minimum time between RPC calls in ms (increased from 500ms)
// Singleton public client instance with proper typing
let publicClientInstance: ReturnType<typeof import('viem').createPublicClient> | null = null;

// Helper function to implement rate limiting for RPC calls
const rateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastRpcCallTime;

  if (timeSinceLastCall < RPC_RATE_LIMIT) {
    // Wait for the rate limit to expire
    await new Promise(resolve => setTimeout(resolve, RPC_RATE_LIMIT - timeSinceLastCall));
  }

  lastRpcCallTime = Date.now();
};

// Helper function to get or create the public client instance
const getPublicClient = async () => {
  if (publicClientInstance) {
    return publicClientInstance;
  }

  // Import necessary functions from viem
  const { createPublicClient, http } = await import('viem');

  // Create a public client with retry logic
  publicClientInstance = createPublicClient({
    chain: liskSepolia,
    transport: http('https://rpc.sepolia-api.lisk.com', {
      retryCount: 3,
      retryDelay: 1000,
    })
  });

  return publicClientInstance;
};

export function usePaymentStream() {
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected } = useXellarWallet();

  // Write contract hooks
  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Helper function to get token address from token type
  const getTokenAddress = useCallback((tokenType: TokenType): `0x${string}` => {
    switch (tokenType) {
      case 'USDC':
        return USDC_ADDRESS;
      case 'IDRX':
        return IDRX_ADDRESS;
      default:
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }, []);

  // Helper function to get token decimals
  const getTokenDecimals = useCallback((tokenType: TokenType): number => {
    switch (tokenType) {
      case 'USDC':
        return 6;
      case 'IDRX':
        return 2;
      default:
        return 18;
    }
  }, []);

  // Helper function to get token symbol from address
  const getTokenSymbol = useCallback((tokenAddress: string): TokenType => {
    if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
      return 'USDC';
    }
    if (tokenAddress.toLowerCase() === IDRX_ADDRESS.toLowerCase()) {
      return 'IDRX';
    }
    throw new Error(`Unknown token address: ${tokenAddress}`);
  }, []);

  // Check if token is approved
  const checkAllowance = useCallback(async (
    tokenType: TokenType,
    amount: string,
    owner: string
  ): Promise<boolean> => {
    try {
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);
      const parsedAmount = parseUnits(amount, decimals);

      // Get the appropriate ABI based on token type
      const abi = tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;

      // Read allowance with retry mechanism
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const allowance = await readContract(config, {
            address: tokenAddress,
            abi,
            functionName: 'allowance',
            args: [owner as `0x${string}`, PAYMENT_STREAM_ADDRESS],
          }) as bigint;

          console.log('Current allowance:', {
            tokenType,
            allowance: allowance.toString(),
            parsedAmount: parsedAmount.toString(),
            isEnough: allowance >= parsedAmount
          });

          return allowance >= parsedAmount;
        } catch (error) {
          console.error(`Error checking allowance (attempt ${retryCount + 1}):`, error);
          if (retryCount === maxRetries) {
            throw error;
          }
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return false; // This line should never be reached due to the throw in the catch block
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  }, [getTokenAddress, getTokenDecimals]);

  // Approve token
  const approveToken = useCallback(async (
    tokenType: TokenType,
    amount: string
  ): Promise<string> => {
    try {
      setIsLoading(true);
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);
      const parsedAmount = parseUnits(amount, decimals);

      // Get the appropriate ABI based on token type
      const abi = tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;

      // Import necessary functions from wagmi
      const { simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const { getAccount } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Use maximum possible approval to avoid future approvals
      const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: tokenAddress,
        abi,
        functionName: 'approve',
        args: [PAYMENT_STREAM_ADDRESS, maxApproval],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Approval transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Approval transaction confirmed:', receipt);

      // Add a small delay to ensure the blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the approval was successful - try multiple times if needed
      let allowance = 0n;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          allowance = await readContract(config, {
            address: tokenAddress,
            abi,
            functionName: 'allowance',
            args: [account.address, PAYMENT_STREAM_ADDRESS],
          }) as bigint;

          console.log(`Allowance check (attempt ${retryCount + 1}):`, {
            allowance: allowance.toString(),
            parsedAmount: parsedAmount.toString(),
            isEnough: allowance >= parsedAmount
          });

          if (allowance >= parsedAmount) {
            break; // Allowance is sufficient, exit the loop
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        } catch (error) {
          console.error(`Error checking allowance (attempt ${retryCount + 1}):`, error);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // If we've tried all retries and still don't have sufficient allowance
      if (allowance < parsedAmount) {
        console.error('Approval verification failed after multiple attempts', {
          allowance: allowance.toString(),
          parsedAmount: parsedAmount.toString()
        });
        throw new Error('Approval verification failed: insufficient allowance');
      }

      toast.success('Token approved successfully');
      return hash;
    } catch (error) {
      console.error('Error approving token:', error);
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          toast.error('Approval rejected by user');
        } else {
          toast.error(`Failed to approve token: ${error.message}`);
        }
      } else {
        toast.error('Failed to approve token');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getTokenAddress, getTokenDecimals]);

  // Create a new payment stream
  const createStream = useCallback(async (
    recipient: string,
    tokenType: TokenType,
    amount: string,
    durationInSeconds: number,
    milestonePercentages: number[] = [],
    milestoneDescriptions: string[] = []
  ): Promise<string> => {
    try {
      setIsLoading(true);
      const tokenAddress = getTokenAddress(tokenType);
      const decimals = getTokenDecimals(tokenType);
      const parsedAmount = parseUnits(amount, decimals);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Check if token is approved
      const isAllowanceSufficient = await checkAllowance(tokenType, amount, account.address);

      if (!isAllowanceSufficient) {
        // Approve token first
        try {
          console.log('Insufficient allowance, approving token...');
          await approveToken(tokenType, amount);

          // Double-check allowance after approval
          const allowanceAfterApproval = await checkAllowance(tokenType, amount, account.address);
          if (!allowanceAfterApproval) {
            console.error('Allowance still insufficient after approval');
            throw new Error('Failed to approve token: allowance still insufficient after approval');
          }
          console.log('Token approval confirmed, proceeding with stream creation');
        } catch (error) {
          console.error('Error during token approval:', error);
          throw new Error(`Token approval failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      } else {
        console.log('Token already approved, proceeding with stream creation');
      }

      // No fee calculation needed
      const netAmount = parsedAmount; // No fee deduction

      // Simulate the transaction first
      let request: { address: `0x${string}`; abi: any; functionName: string; args: any[]; account: `0x${string}` };
      try {
        const simulationResult = await simulateContract(config, {
          address: PAYMENT_STREAM_ADDRESS,
          abi: PaymentStreamABI.abi,
          functionName: 'createStream',
          args: [
            recipient as `0x${string}`,
            tokenAddress,
            parsedAmount,
            BigInt(durationInSeconds),
            milestonePercentages.map(p => BigInt(p)),
            milestoneDescriptions
          ],
          account: account.address,
        });
        request = simulationResult.request;
      } catch (error) {
        console.error('Simulation error:', error);
        if (error instanceof Error && error.message.includes('0xfb8f41b2')) {
          console.log('Ignoring known error signature 0xfb8f41b2 and proceeding with transaction');
          request = {
            address: PAYMENT_STREAM_ADDRESS,
            abi: PaymentStreamABI.abi,
            functionName: 'createStream',
            args: [
              recipient as `0x${string}`,
              tokenAddress,
              parsedAmount,
              BigInt(durationInSeconds),
              milestonePercentages.map(p => BigInt(p)),
              milestoneDescriptions
            ],
            account: account.address,
          };
        } else {
          throw error;
        }
      }

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Stream creation transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Stream creation transaction confirmed:', receipt);

      // Extract stream ID from logs using viem's decodeEventLog
      let streamId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: PaymentStreamABI.abi,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === 'StreamCreated') {
            const args = event.args;
            if (
              args &&
              typeof args === 'object' &&
              !Array.isArray(args) &&
              Object.prototype.hasOwnProperty.call(args, 'streamId') &&
              typeof (args as { streamId?: string }).streamId === 'string'
            ) {
              streamId = (args as { streamId: string }).streamId;
              break;
            }
          }
        } catch (e) {
          // Ignore errors when decoding event logs
        }
      }

      if (!streamId) {
        console.error('All logs for debugging:', receipt.logs);
        throw new Error('Stream creation event not found in transaction logs');
      }

      toast.success('Stream created successfully');
      return streamId;
    } catch (error) {
      console.error('Error creating stream:', error);
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          toast.error('Stream creation rejected by user');
        } else {
          toast.error(`Failed to create stream: ${error.message}`);
        }
      } else {
        toast.error('Failed to create stream');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getTokenAddress, getTokenDecimals, checkAllowance, approveToken]);

  // Pause a stream
  const pauseStream = useCallback(async (streamId: string): Promise<string> => {
    try {
      setIsLoading(true);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Pausing stream with ID:', hexStreamId);

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: PAYMENT_STREAM_ADDRESS,
        abi: PaymentStreamABI.abi,
        functionName: 'pauseStream',
        args: [hexStreamId],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Stream pause transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Stream pause transaction confirmed:', receipt);

      return hash;
    } catch (error) {
      console.error('Error pausing stream:', error);
      toast.error('Failed to pause stream');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resume a stream
  const resumeStream = useCallback(async (streamId: string): Promise<string> => {
    try {
      setIsLoading(true);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Resuming stream with ID:', hexStreamId);

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: PAYMENT_STREAM_ADDRESS,
        abi: PaymentStreamABI.abi,
        functionName: 'resumeStream',
        args: [hexStreamId],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Stream resume transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Stream resume transaction confirmed:', receipt);

      return hash;
    } catch (error) {
      console.error('Error resuming stream:', error);
      toast.error('Failed to resume stream');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cancel a stream
  const cancelStream = useCallback(async (streamId: string): Promise<string> => {
    try {
      setIsLoading(true);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Canceling stream with ID:', hexStreamId);

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: PAYMENT_STREAM_ADDRESS,
        abi: PaymentStreamABI.abi,
        functionName: 'cancelStream',
        args: [hexStreamId],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Stream cancel transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Stream cancel transaction confirmed:', receipt);

      return hash;
    } catch (error) {
      console.error('Error canceling stream:', error);
      toast.error('Failed to cancel stream');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Release a milestone
  const releaseMilestone = useCallback(async (
    streamId: string,
    milestoneIndex: number
  ): Promise<string> => {
    try {
      setIsLoading(true);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Releasing milestone for stream ID:', hexStreamId, 'milestone index:', milestoneIndex);

      // Simulate the transaction first
      const { request } = await simulateContract(config, {
        address: PAYMENT_STREAM_ADDRESS,
        abi: PaymentStreamABI.abi,
        functionName: 'releaseMilestone',
        args: [hexStreamId, BigInt(milestoneIndex)],
        account: account.address,
      });

      // Send the transaction
      const hash = await writeContractAction(config, request);
      console.log('Milestone release transaction sent with hash:', hash);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, { hash });
      console.log('Milestone release transaction confirmed:', receipt);

      return hash;
    } catch (error) {
      console.error('Error releasing milestone:', error);
      toast.error('Failed to release milestone');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get stream details with caching and rate limiting
  const getStreamDetails = useCallback(async (streamId: string): Promise<Stream | null> => {
    try {
      // Check cache first
      const now = Date.now();
      const cachedStream = streamCache.get(streamId);

      if (cachedStream && (now - cachedStream.timestamp) < CACHE_TTL) {
        console.log('Using cached stream data for ID:', streamId);
        return cachedStream.data;
      }

      // Apply rate limiting
      await rateLimit();

      // Get or create the public client instance
      const publicClient = await getPublicClient();

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Getting details for stream ID:', hexStreamId);

      // Get stream details with error handling
      let streamData: [string, string, string, bigint, bigint, bigint, bigint, number] | null = null;
      try {
        streamData = await publicClient.readContract({
          address: PAYMENT_STREAM_ADDRESS,
          abi: PaymentStreamABI.abi,
          functionName: 'getStream',
          args: [hexStreamId],
        }) as [string, string, string, bigint, bigint, bigint, bigint, number];
      } catch (error) {
        console.error('Error reading stream data, retrying with delay:', error);
        // Wait and retry once more with a longer delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          streamData = await publicClient.readContract({
            address: PAYMENT_STREAM_ADDRESS,
            abi: PaymentStreamABI.abi,
            functionName: 'getStream',
            args: [hexStreamId],
          }) as [string, string, string, bigint, bigint, bigint, bigint, number];
        } catch (retryError) {
          console.error('Retry failed, using cached data if available:', retryError);
          // If we have cached data, return it even if expired
          if (cachedStream) {
            return cachedStream.data;
          }
          throw retryError;
        }
      }

      if (!streamData || !streamData[0]) {
        return null;
      }

      // Get token symbol and calculate streamed amount locally
      const tokenSymbol = getTokenSymbol(streamData[2]);
      const decimals = getTokenDecimals(tokenSymbol);

      // Format the stream data
      const stream: Stream = {
        id: streamId,
        sender: streamData[0],
        recipient: streamData[1],
        tokenAddress: streamData[2],
        tokenSymbol,
        amount: formatUnits(streamData[3], decimals),
        streamed: formatUnits(streamData[4], decimals),
        startTime: Number(streamData[5]),
        endTime: Number(streamData[6]),
        status: Number(streamData[7]),
        milestones: [] // Initialize with empty array
      };

      // Only fetch milestones if the stream is active or paused
      // This reduces unnecessary RPC calls for completed/canceled streams
      if (stream.status === StreamStatus.Active || stream.status === StreamStatus.Paused) {
        // Apply rate limiting before next RPC call
        await rateLimit();

        // Get milestone count with error handling
        let milestoneCount: bigint = BigInt(0);
        try {
          milestoneCount = await publicClient.readContract({
            address: PAYMENT_STREAM_ADDRESS,
            abi: PaymentStreamABI.abi,
            functionName: 'getMilestoneCount',
            args: [hexStreamId],
          }) as bigint;
        } catch (error) {
          console.error('Error getting milestone count, assuming 0:', error);
          // If we have cached data, use the milestones from there
          if (cachedStream) {
            stream.milestones = cachedStream.data.milestones;
            milestoneCount = BigInt(0); // Skip further milestone fetching
          }
        }

        // If we have cached milestones and encounter an error, use them as fallback
        const cachedMilestones = cachedStream?.data.milestones || [];

        // Only fetch milestones if there are any and we don't already have them from cache
        if (Number(milestoneCount) > 0 && stream.milestones.length === 0) {
          // Batch milestone fetches to reduce RPC calls
          const milestoneBatchSize = 3; // Fetch 3 milestones at a time

          for (let i = 0; i < Number(milestoneCount); i += milestoneBatchSize) {
            // Apply rate limiting between milestone batches
            if (i > 0) await rateLimit();

            // Create a batch of promises for this group of milestones
            const batchPromises = [];
            for (let j = i; j < Math.min(i + milestoneBatchSize, Number(milestoneCount)); j++) {
              // Use cached milestone as fallback if available
              if (j < cachedMilestones.length) {
                batchPromises.push(Promise.resolve(cachedMilestones[j]));
                continue;
              }

              // Otherwise fetch from blockchain
              batchPromises.push(
                publicClient.readContract({
                  address: PAYMENT_STREAM_ADDRESS,
                  abi: PaymentStreamABI.abi,
                  functionName: 'getMilestone',
                  args: [hexStreamId, BigInt(j)],
                }).then((data: any) => ({
                  percentage: Number(data[0]),
                  description: data[1],
                  released: data[2]
                })).catch(error => {
                  console.error(`Error getting milestone ${j}:`, error);
                  // Return cached milestone if available, otherwise null
                  return j < cachedMilestones.length ? cachedMilestones[j] : null;
                })
              );
            }

            // Wait for all milestones in this batch
            const batchResults = await Promise.all(batchPromises);

            // Add valid milestones to the stream
            for (const milestone of batchResults) {
              if (milestone) {
                stream.milestones.push(milestone);
              }
            }
          }
        } else if (stream.milestones.length === 0 && cachedMilestones.length > 0) {
          // Use cached milestones if we have them
          stream.milestones = cachedMilestones;
        }
      } else if (cachedStream) {
        // For completed/canceled streams, use cached milestones if available
        stream.milestones = cachedStream.data.milestones;
      }

      // Update cache with the new data
      streamCache.set(streamId, { data: stream, timestamp: now });

      return stream;
    } catch (error) {
      console.error('Error getting stream details:', error);

      // If we have cached data, return it even if expired as a fallback
      const cachedStream = streamCache.get(streamId);
      if (cachedStream) {
        console.log('Using expired cached data as fallback');
        return cachedStream.data;
      }

      return null;
    }
  }, [getTokenSymbol, getTokenDecimals]);

  // Withdraw from a stream
  const withdrawFromStream = useCallback(async (streamId: string): Promise<string | null> => {
    try {
      setIsLoading(true);

      // Import necessary functions from wagmi
      const { getAccount, simulateContract, writeContract: writeContractAction } = await import('wagmi/actions');
      const account = getAccount(config);

      if (!account || !account.address) {
        throw new Error("No wallet connected");
      }

      // Ensure streamId is a valid hex string
      const hexStreamId = streamId.startsWith('0x') ? streamId as `0x${string}` : `0x${streamId}` as `0x${string}`;
      console.log('Withdrawing from stream ID:', hexStreamId);

      // First, update the stream to ensure the latest streamed amount is recorded
      try {
        await simulateContract(config, {
          address: PAYMENT_STREAM_ADDRESS,
          abi: PaymentStreamABI.abi,
          functionName: 'updateStream',
          args: [hexStreamId],
          account: account.address,
        }).then(({ request }) => writeContractAction(config, request));

        console.log('Stream updated before withdrawal');
      } catch (error) {
        console.warn('Error updating stream before withdrawal:', error);
        // Continue with withdrawal even if update fails
      }

      // Get stream details before withdrawal to show amount claimed
      const streamBefore = await getStreamDetails(streamId);
      if (!streamBefore) {
        throw new Error("Could not fetch stream details");
      }

      // Check if there are tokens to claim
      if (Number(streamBefore.streamed) <= 0) {
        console.log('No tokens to claim for stream:', streamId);
        toast.error('No tokens available to claim');
        return null;
      }

      try {
        // Simulate the transaction first
        const { request } = await simulateContract(config, {
          address: PAYMENT_STREAM_ADDRESS,
          abi: PaymentStreamABI.abi,
          functionName: 'withdrawFromStream',
          args: [hexStreamId],
          account: account.address,
        });

        // Send the transaction
        const hash = await writeContractAction(config, request);
        console.log('Stream withdrawal transaction sent with hash:', hash);

        // Wait for transaction to be confirmed
        const receipt = await waitForTransactionReceipt(config, { hash });
        console.log('Stream withdrawal transaction confirmed:', receipt);

        // Format the claimed amount to 4 decimal places
        const claimedAmount = Number(streamBefore.streamed).toFixed(4);

        // Show success message with claimed amount
        toast.success(
          `Successfully claimed ${claimedAmount} ${streamBefore.tokenSymbol} from stream!`,
          { duration: 5000 }
        );

        // Log detailed information about the claim
        console.log('Stream claim successful', {
          streamId,
          claimedAmount,
          token: streamBefore.tokenSymbol,
          transactionHash: hash
        });

        // Get stream details after withdrawal to check if it's fully claimed
        const streamAfter = await getStreamDetails(streamId);

        // Check if the stream is now fully claimed (amount == streamed)
        if (streamAfter &&
            Number(streamAfter.amount) === Number(streamAfter.streamed) &&
            streamAfter.status !== StreamStatus.Completed) {
          console.log('Stream is fully claimed, updating status to Completed:', streamId);

          // Update the stream status to Completed
          try {
            await simulateContract(config, {
              address: PAYMENT_STREAM_ADDRESS,
              abi: PaymentStreamABI.abi,
              functionName: 'completeStream',
              args: [hexStreamId],
              account: account.address,
            }).then(({ request }) => writeContractAction(config, request));

            console.log('Stream status updated to Completed');
          } catch (error) {
            console.error('Error updating stream status to Completed:', error);
            // Don't throw here, as the withdrawal was successful
          }
        }

        return hash;
      } catch (error) {
        // Check for specific error messages
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('transfer amount exceeds balance')) {
          console.error('Contract has insufficient balance for withdrawal:', error);
          toast.error('Insufficient balance in contract', {
            description: 'The contract does not have enough tokens to complete this withdrawal. Please try again later or contact support.'
          });
          return null;
        }

        // Re-throw other errors
        throw error;
      }
    } catch (error) {
      console.error('Error withdrawing from stream:', error);

      // Handle specific error cases with better messages
      if (error instanceof Error) {
        if (error.message.includes('NotStreamRecipient')) {
          toast.error('Not authorized', {
            description: 'Only the recipient can withdraw from this stream'
          });
        } else if (error.message.includes('StreamNotFound')) {
          toast.error('Stream not found');
        } else if (error.message.includes('NoFundsToWithdraw')) {
          toast.error('No funds to withdraw');
        } else {
          toast.error('Failed to withdraw from stream', {
            description: error.message
          });
        }
      } else {
        toast.error('Failed to withdraw from stream');
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getStreamDetails]);

  // Check if a stream is fully claimed
  const isStreamFullyClaimed = useCallback((stream: Stream): boolean => {
    // If stream is already completed or canceled, return true
    if (stream.status === StreamStatus.Completed || stream.status === StreamStatus.Canceled) {
      return true;
    }

    // Check if the stream has no tokens left to claim (streamed amount is 0)
    if (Number(stream.streamed) <= 0) {
      return true;
    }

    return false;
  }, []);

  // Get streams for a user (both as sender and recipient)
  const useUserStreams = (userAddress?: string) => {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(0);
    const { address: walletAddress } = useXellarWallet();
    const address = userAddress || walletAddress;

    // Function to update a stream's status in the local state
    const updateStreamStatus = useCallback((streamId: string, newStatus?: StreamStatus) => {
      setStreams(prevStreams => {
        // If newStatus is provided, update the status
        if (newStatus !== undefined) {
          return prevStreams.map(stream =>
            stream.id === streamId
              ? { ...stream, status: newStatus }
              : stream
          );
        }

        // Otherwise, just refresh the stream data from cache
        const cachedStream = streamCache.get(streamId);
        if (cachedStream) {
          return prevStreams.map(stream =>
            stream.id === streamId
              ? cachedStream.data
              : stream
          );
        }

        return prevStreams;
      });
    }, []);

    // Function to update stream data in real-time without fetching from blockchain
    const updateStreamData = useCallback(() => {
      const now = Math.floor(Date.now() / 1000);

      setStreams(prevStreams => {
        return prevStreams.map(stream => {
          // Only update active streams
          if (stream.status !== StreamStatus.Active) {
            return stream;
          }

          // Calculate new streamed amount based on time elapsed
          const startTime = stream.startTime;
          const endTime = stream.endTime;
          const totalAmount = Number(stream.amount);

          // If stream hasn't started yet or has ended, don't update
          if (now < startTime || now >= endTime) {
            return stream;
          }

          // Calculate elapsed time as a fraction of total duration
          const totalDuration = endTime - startTime;
          const elapsedDuration = Math.min(now - startTime, totalDuration);
          const elapsedFraction = elapsedDuration / totalDuration;

          // Calculate new streamed amount
          const newStreamed = (totalAmount * elapsedFraction).toFixed(6);

          // Update the stream with new streamed amount
          return {
            ...stream,
            streamed: newStreamed
          };
        });
      });
    }, []);

    const fetchStreams = useCallback(async (force = false) => {
      if (!address) return;

      const now = Date.now();

      // Don't fetch if we've fetched recently, unless forced
      if (!force && (now - lastFetchTime) < STREAM_FETCH_INTERVAL) {
        console.log('Skipping fetch, using cached data');
        updateStreamData();
        return;
      }

      setIsLoading(true);
      try {
        // Apply rate limiting
        await rateLimit();

        try {
          // Import necessary functions from viem
          const { getAbiItem } = await import('viem');

          // Get or create the public client instance
          const publicClient = await getPublicClient();

          // Get the StreamCreated event ABI
          const streamCreatedEventAbi = getAbiItem({
            abi: PaymentStreamABI.abi,
            name: 'StreamCreated',
          });

          // Use a single getLogs call with a filter for either sender or recipient
          // This reduces the number of RPC calls
          const allStreamIds = new Set<string>();

          // First check if we have any cached stream IDs
          const cachedStreamIds = Array.from(streamCache.keys());
          if (cachedStreamIds.length > 0) {
            // Add all cached stream IDs to our set
            for (const id of cachedStreamIds) {
              allStreamIds.add(id);
            }
          }

          // Only fetch logs if forced or we don't have any cached streams
          if (force || cachedStreamIds.length === 0) {
            try {
              // Get logs for all StreamCreated events in a single call
              // We'll filter for the user's address client-side
              const logs = await publicClient.getLogs({
                address: PAYMENT_STREAM_ADDRESS,
                event: streamCreatedEventAbi,
                fromBlock: BigInt(0),
                toBlock: 'latest',
              });

              // Filter logs client-side to find streams where user is sender or recipient
              for (const log of logs) {
                const args = log.args;
                if (!args) continue;

                const sender = args.sender as `0x${string}` | undefined;
                const recipient = args.recipient as `0x${string}` | undefined;
                const streamId = args.streamId as string | undefined;

                if (streamId &&
                    (sender?.toLowerCase() === address.toLowerCase() ||
                     recipient?.toLowerCase() === address.toLowerCase())) {
                  allStreamIds.add(streamId);
                }
              }
            } catch (error) {
              console.error('Error fetching stream logs:', error);
              // If we have cached stream IDs, we can still use those
              if (cachedStreamIds.length === 0) {
                throw error; // Re-throw if we have no fallback
              }
            }
          }

          // If we have no stream IDs, return empty array
          if (allStreamIds.size === 0) {
            console.log('No streams found');
            setStreams([]);
            setIsLoading(false);
            return;
          }

          // Fetch details for each stream with batching to reduce RPC calls
          const batchSize = 5; // Process 5 streams at a time
          const allStreamIdsArray = Array.from(allStreamIds);
          const allStreams: Stream[] = [];

          for (let i = 0; i < allStreamIdsArray.length; i += batchSize) {
            const batch = allStreamIdsArray.slice(i, i + batchSize);

            // Process this batch in parallel
            const batchResults = await Promise.all(
              batch.map(streamId => getStreamDetails(streamId))
            );

            // Add valid streams to our result array
            for (const stream of batchResults) {
              if (stream !== null) {
                allStreams.push(stream);
              }
            }

            // Add a small delay between batches to avoid rate limiting
            if (i + batchSize < allStreamIdsArray.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          console.log('Fetched streams:', allStreams);

          if (allStreams.length > 0) {
            setStreams(allStreams);
            setLastFetchTime(now);
          } else {
            // If no streams were found, set empty array
            setStreams([]);
          }
        } catch (error) {
          console.error('Error fetching streams from blockchain:', error);

          // If we have cached streams, use them as fallback
          const cachedStreams = Array.from(streamCache.values()).map(item => item.data);
          if (cachedStreams.length > 0) {
            console.log('Using cached streams as fallback');
            setStreams(cachedStreams);
          } else {
            setStreams([]);
          }
        }
      } catch (error) {
        console.error('Error fetching streams:', error);
        setStreams([]);
      } finally {
        setIsLoading(false);
      }
    }, [address, lastFetchTime, updateStreamData]);

    // Set up interval to update stream data without fetching from blockchain
    useEffect(() => {
      // Initial fetch - only if we don't have cached data
      const hasCachedStreams = streamCache.size > 0;
      if (!hasCachedStreams) {
        fetchStreams(true);
      } else {
        // If we have cached data, just update it locally
        updateStreamData();
        // And schedule a background refresh
        setTimeout(() => {
          fetchStreams(false);
        }, 5000);
      }

      // Set up interval to update stream data in the UI
      const intervalId = setInterval(() => {
        updateStreamData();
      }, UI_UPDATE_INTERVAL);

      // Set up interval to fetch from blockchain less frequently
      const fetchIntervalId = setInterval(() => {
        fetchStreams(false);
      }, STREAM_FETCH_INTERVAL);

      return () => {
        clearInterval(intervalId);
        clearInterval(fetchIntervalId);
      };
    }, [fetchStreams, updateStreamData]);

    return {
      streams,
      isLoading,
      refetch: () => fetchStreams(true),
      updateStreamStatus
    };
  };

  // Return all the functions and values
  return {
    isLoading: isLoading || isPending || isConfirming,
    isConfirmed,
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    getStreamDetails,
    isStreamFullyClaimed,
    useUserStreams,
    getTokenAddress,
    getTokenDecimals,
    getTokenSymbol,
    checkAllowance,
    approveToken,
    USDC_ADDRESS,
    IDRX_ADDRESS,
  };
}
