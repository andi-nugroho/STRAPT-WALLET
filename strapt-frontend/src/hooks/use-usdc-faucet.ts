import { useState, useCallback, useEffect } from 'react';
import { formatUnits } from 'viem';
import { toast } from 'sonner';
import { readContract, simulateContract, writeContract, waitForTransactionReceipt, getAccount } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';
import USDCFaucetABI from '@/contracts/USDCFaucet.json';
import contractConfig from '@/contracts/contract-config.json';
import { useXellarWallet } from './use-xellar-wallet';
import { USDC_DECIMALS } from './useTokenUtils';

// Constants
const USDC_FAUCET_ADDRESS = contractConfig.USDCFaucet.address as `0x${string}`;
const CLAIM_AMOUNT = BigInt(contractConfig.USDCFaucet.claimAmount);
const COOLDOWN_PERIOD = contractConfig.USDCFaucet.cooldownPeriod;
const MAX_CLAIM_PER_ADDRESS = BigInt(contractConfig.USDCFaucet.maxClaimPerAddress);

// Types
interface FaucetInfo {
  claimAmount: bigint;
  cooldownPeriod: number;
  maxClaimPerAddress: bigint;
  faucetBalance: bigint;
}

interface UserClaimInfo {
  lastClaimTime: bigint;
  totalClaimed: bigint;
  timeUntilNextClaim: bigint;
  remainingAllowance: bigint;
  canClaim: boolean;
}

/**
 * Hook for interacting with the USDC Faucet contract
 */
export function useUSDCFaucet() {
  const { address, isConnected } = useXellarWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [faucetInfo, setFaucetInfo] = useState<FaucetInfo>({
    claimAmount: CLAIM_AMOUNT,
    cooldownPeriod: COOLDOWN_PERIOD,
    maxClaimPerAddress: MAX_CLAIM_PER_ADDRESS,
    faucetBalance: 0n
  });
  const [userClaimInfo, setUserClaimInfo] = useState<UserClaimInfo>({
    lastClaimTime: 0n,
    totalClaimed: 0n,
    timeUntilNextClaim: 0n,
    remainingAllowance: 0n,
    canClaim: false
  });

  // Format time remaining in a human-readable format
  const formatTimeRemaining = useCallback((seconds: bigint): string => {
    if (seconds === 0n) return 'Can claim now';

    const secondsNum = Number(seconds);
    const hours = Math.floor(secondsNum / 3600);
    const minutes = Math.floor((secondsNum % 3600) / 60);
    const remainingSeconds = secondsNum % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }, []);

  // Function to reload data (used internally)
  const reloadData = useCallback(async () => {
    try {
      // Get claim amount
      let claimAmount = CLAIM_AMOUNT;
      try {
        claimAmount = await readContract(config, {
          address: USDC_FAUCET_ADDRESS,
          abi: USDCFaucetABI.abi,
          functionName: 'claimAmount',
        }) as bigint;
      } catch (error) {
        console.error('Error getting claim amount:', error);
      }

      // Get cooldown period
      let cooldownPeriod = BigInt(COOLDOWN_PERIOD);
      try {
        cooldownPeriod = await readContract(config, {
          address: USDC_FAUCET_ADDRESS,
          abi: USDCFaucetABI.abi,
          functionName: 'cooldownPeriod',
        }) as bigint;
      } catch (error) {
        console.error('Error getting cooldown period:', error);
      }

      // Get max claim per address
      let maxClaimPerAddress = MAX_CLAIM_PER_ADDRESS;
      try {
        maxClaimPerAddress = await readContract(config, {
          address: USDC_FAUCET_ADDRESS,
          abi: USDCFaucetABI.abi,
          functionName: 'maxClaimPerAddress',
        }) as bigint;
      } catch (error) {
        console.error('Error getting max claim per address:', error);
      }

      // Get faucet balance
      let faucetBalance = 0n;
      try {
        faucetBalance = await readContract(config, {
          address: USDC_FAUCET_ADDRESS,
          abi: USDCFaucetABI.abi,
          functionName: 'getFaucetBalance',
        }) as bigint;
      } catch (error) {
        console.error('Error getting faucet balance:', error);
      }

      const faucetData = {
        claimAmount,
        cooldownPeriod: Number(cooldownPeriod),
        maxClaimPerAddress,
        faucetBalance
      };

      setFaucetInfo(faucetData);

      // Now load user data if connected
      if (isConnected && address) {
        let lastClaimTime = 0n;
        let totalClaimed = 0n;
        let timeUntilNextClaim = 0n;
        let remainingAllowance = 0n;

        try {
          lastClaimTime = await readContract(config, {
            address: USDC_FAUCET_ADDRESS,
            abi: USDCFaucetABI.abi,
            functionName: 'lastClaimTime',
            args: [address],
          }) as bigint;
        } catch (error) {
          console.error('Error getting last claim time:', error);
        }

        try {
          totalClaimed = await readContract(config, {
            address: USDC_FAUCET_ADDRESS,
            abi: USDCFaucetABI.abi,
            functionName: 'totalClaimed',
            args: [address],
          }) as bigint;
        } catch (error) {
          console.error('Error getting total claimed:', error);
        }

        try {
          timeUntilNextClaim = await readContract(config, {
            address: USDC_FAUCET_ADDRESS,
            abi: USDCFaucetABI.abi,
            functionName: 'timeUntilNextClaim',
            args: [address],
          }) as bigint;
        } catch (error) {
          console.error('Error getting time until next claim:', error);
        }

        try {
          remainingAllowance = await readContract(config, {
            address: USDC_FAUCET_ADDRESS,
            abi: USDCFaucetABI.abi,
            functionName: 'remainingClaimAllowance',
            args: [address],
          }) as bigint;
        } catch (error) {
          console.error('Error getting remaining allowance:', error);
          remainingAllowance = maxClaimPerAddress;
        }

        const hasSufficientBalance = faucetBalance >= claimAmount;

        setUserClaimInfo({
          lastClaimTime,
          totalClaimed,
          timeUntilNextClaim,
          remainingAllowance,
          canClaim: timeUntilNextClaim === 0n &&
                    remainingAllowance >= claimAmount &&
                    hasSufficientBalance
        });
      }
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  }, [address, isConnected]);

  // Claim tokens from the faucet
  const claimTokens = useCallback(async (): Promise<boolean> => {
    try {
      if (!isConnected || !address) {
        toast.error('Please connect your wallet');
        return false;
      }

      setIsClaiming(true);

      // Check if user can claim based on current state
      if (!userClaimInfo.canClaim) {
        if (userClaimInfo.timeUntilNextClaim > 0n) {
          toast.error(`Cooldown period not expired`, {
            description: `Please wait ${formatTimeRemaining(userClaimInfo.timeUntilNextClaim)} before claiming again`
          });
        } else if (userClaimInfo.remainingAllowance < faucetInfo.claimAmount) {
          toast.error('Maximum claim limit reached', {
            description: `You've reached your maximum claim limit of ${formatUnits(faucetInfo.maxClaimPerAddress, USDC_DECIMALS)} USDC`
          });
        } else if (faucetInfo.faucetBalance < faucetInfo.claimAmount) {
          toast.error('Insufficient faucet balance', {
            description: 'The faucet does not have enough USDC to fulfill your claim'
          });
        } else {
          toast.error('Cannot claim tokens at this time');
        }
        return false;
      }

      // Get the account
      const account = getAccount(config);
      if (!account || !account.address) {
        throw new Error('No wallet connected');
      }

      // Simulate the claim transaction
      const { request } = await simulateContract(config, {
        address: USDC_FAUCET_ADDRESS,
        abi: USDCFaucetABI.abi,
        functionName: 'claimTokens',
        account: account.address,
      });

      // Send the claim transaction
      toast.info('Claiming USDC tokens...');
      const hash = await writeContract(config, request);

      // Wait for transaction to be confirmed
      const receipt = await waitForTransactionReceipt(config, {
        hash,
      });

      if (receipt.status === 'success') {
        toast.success('USDC tokens claimed successfully', {
          description: `You've claimed ${formatUnits(faucetInfo.claimAmount, USDC_DECIMALS)} USDC from the faucet`
        });

        // Reload data after successful claim
        await reloadData();

        return true;
      } else {
        toast.error('Failed to claim USDC tokens');
        return false;
      }
    } catch (error) {
      console.error('Error claiming tokens:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle specific error messages
      if (errorMessage.includes('CooldownNotExpired')) {
        toast.error('Cooldown period not expired', {
          description: 'Please wait before claiming again'
        });
      } else if (errorMessage.includes('MaxClaimLimitReached')) {
        toast.error('Maximum claim limit reached', {
          description: `You've reached your maximum claim limit`
        });
      } else if (errorMessage.includes('InsufficientFaucetBalance')) {
        toast.error('Insufficient faucet balance', {
          description: 'The faucet does not have enough USDC to fulfill your claim'
        });
      } else {
        toast.error('Failed to claim tokens', {
          description: errorMessage
        });
      }

      return false;
    } finally {
      setIsClaiming(false);
    }
  }, [address, isConnected, faucetInfo, userClaimInfo, formatTimeRemaining, reloadData]);

  // Load faucet and user info on mount and when wallet changes
  useEffect(() => {
    // Load data when component mounts or wallet connection changes
    reloadData();
  }, [reloadData]);

  return {
    isClaiming,
    faucetInfo,
    userClaimInfo,
    claimTokens,
    formatTimeRemaining,
    reloadData,
  };
}
