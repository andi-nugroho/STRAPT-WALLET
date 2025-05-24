import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { toast } from 'sonner';
import { TokenOption } from '@/components/TokenSelect';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';
import contractConfig from '@/contracts/contract-config.json';
import { readContract, writeContract } from 'wagmi/actions';
import { config } from '@/providers/XellarProvider';

// Export token addresses and decimals as constants
export const USDC_ADDRESS = USDCABI.address as `0x${string}`;
export const IDRX_ADDRESS = IDRXABI.address as `0x${string}`;
export const USDC_DECIMALS = 6;
export const IDRX_DECIMALS = 2;

// Token type definition
export type TokenType = 'USDC' | 'IDRX';

/**
 * Hook for token-related utilities
 * Provides functions for token addresses, decimals, and validation
 */
export function useTokenUtils() {
  const { address } = useAccount();
  // Get token address from token type
  const getTokenAddress = (tokenType: TokenType): `0x${string}` => {
    switch (tokenType) {
      case 'USDC':
        return USDC_ADDRESS;
      case 'IDRX':
        return IDRX_ADDRESS;
      default:
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  };

  // Get token decimals from token type
  const getTokenDecimals = (tokenType: TokenType): number => {
    switch (tokenType) {
      case 'USDC':
        return USDC_DECIMALS;
      case 'IDRX':
        return IDRX_DECIMALS;
      default:
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  };

  // Get token symbol from token type
  const getTokenSymbol = (tokenType: TokenType): string => {
    return tokenType;
  };

  // Get token ABI from token type
  const getTokenABI = (tokenType: TokenType) => {
    return tokenType === 'USDC' ? USDCABI.abi : IDRXABI.abi;
  };

  // Parse amount with correct decimals
  const parseTokenAmount = (amount: string, tokenType: TokenType): bigint => {
    const decimals = getTokenDecimals(tokenType);
    return parseUnits(amount, decimals);
  };

  // Format amount with correct decimals
  const formatTokenAmount = (amount: bigint, tokenType: TokenType): string => {
    const decimals = getTokenDecimals(tokenType);
    return formatUnits(amount, decimals);
  };

  // Validate amount before transfer
  const validateAmount = (amount: string, tokenBalance: number, tokenSymbol: string): boolean => {
    // Check if amount is empty or not a number
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Invalid amount", {
        description: "Please enter a valid amount greater than 0"
      });
      return false;
    }

    // Check if amount is greater than balance
    if (tokenBalance && Number(amount) > tokenBalance) {
      toast.error("Insufficient balance", {
        description: `You only have ${tokenBalance} ${tokenSymbol} available`
      });
      return false;
    }

    return true;
  };

  // Get token type from token symbol
  const getTokenTypeFromSymbol = (symbol: string): TokenType => {
    return symbol === 'USDC' ? 'USDC' : 'IDRX';
  };

  /**
   * Check token allowance
   * @param tokenType Token type
   * @param amount Amount as string
   * @param ownerAddress Owner address
   * @param spenderAddress Spender address
   * @returns Promise with boolean indicating if allowance is sufficient
   */
  const checkAllowance = async (
    tokenType: TokenType,
    amount: string,
    ownerAddress: string,
    spenderAddress: `0x${string}`
  ): Promise<boolean> => {
    try {
      // Get token address and parse amount
      const tokenAddress = getTokenAddress(tokenType);
      const parsedAmount = parseTokenAmount(amount, tokenType);
      const tokenABI = getTokenABI(tokenType);

      // Read allowance
      const allowance = await readContract(config, {
        abi: tokenABI,
        address: tokenAddress,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, spenderAddress],
      });

      const allowanceBigInt = BigInt(allowance as string || '0');

      console.log('Token allowance check:', {
        token: tokenType,
        allowance: allowanceBigInt.toString(),
        required: parsedAmount.toString(),
        sufficient: allowanceBigInt >= parsedAmount
      });

      // Return true if allowance is sufficient
      return allowanceBigInt >= parsedAmount;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  /**
   * Approve token for spender
   * @param tokenType Token type
   * @param amount Amount as string
   * @param spenderAddress Spender address
   * @returns Promise with boolean indicating if approval was successful
   */
  const approveToken = async (
    tokenType: TokenType,
    amount: string,
    spenderAddress: `0x${string}`
  ): Promise<boolean> => {
    try {
      if (!address) {
        toast.error("No wallet connected");
        return false;
      }

      // Get token address and parse amount
      const tokenAddress = getTokenAddress(tokenType);
      const parsedAmount = parseTokenAmount(amount, tokenType);
      const tokenABI = getTokenABI(tokenType);

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
      const { waitForTransactionReceipt } = await import('wagmi/actions');
      const receipt = await waitForTransactionReceipt(config, {
        hash
      });

      if (receipt.status === 'success') {
        toast.success("Token approval successful");
        return true;
      }

      toast.error("Token approval failed");
      return false;
    } catch (error) {
      console.error('Error approving token:', error);
      toast.error("Failed to approve token");
      return false;
    }
  };

  return {
    getTokenAddress,
    getTokenDecimals,
    getTokenSymbol,
    getTokenABI,
    parseTokenAmount,
    formatTokenAmount,
    validateAmount,
    getTokenTypeFromSymbol,
    checkAllowance,
    approveToken,
    USDC_ADDRESS,
    IDRX_ADDRESS,
    USDC_DECIMALS,
    IDRX_DECIMALS,
  };
}

/**
 * Hook for token balances with optimized caching and memoization
 * Provides token balances and loading state
 */
export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState<TokenOption[]>([
    { symbol: 'IDRX', name: 'IDRX Token', balance: 0, icon: '/IDRX BLUE COIN.svg' },
    { symbol: 'USDC', name: 'USD Coin', balance: 0, icon: '/usd-coin-usdc-logo.svg' },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Cache the last known balances to prevent UI flicker during refreshes
  const lastKnownBalances = useRef<{
    idrx: number | null;
    usdc: number | null;
  }>({
    idrx: null,
    usdc: null
  });

  // Get USDC balance with optimized polling interval
  const { data: usdcBalance, isLoading: isLoadingUsdc } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    query: {
      enabled: isConnected,
      staleTime: 30000, // Consider data fresh for 30 seconds
      refetchInterval: 60000, // Refetch every 60 seconds
      refetchOnWindowFocus: true, // Refetch when window regains focus
    },
  });

  // Get IDRX balance with optimized polling interval
  const { data: idrxBalance, isLoading: isLoadingIdrx } = useBalance({
    address: address,
    token: IDRX_ADDRESS,
    query: {
      enabled: isConnected,
      staleTime: 30000, // Consider data fresh for 30 seconds
      refetchInterval: 60000, // Refetch every 60 seconds
      refetchOnWindowFocus: true, // Refetch when window regains focus
    },
  });

  // Memoize the token data to prevent unnecessary re-renders
  const memoizedTokens = useMemo(() => {
    if (!isConnected) {
      return [
        { symbol: 'IDRX', name: 'IDRX Token', balance: 0, icon: '/IDRX BLUE COIN.svg' },
        { symbol: 'USDC', name: 'USD Coin', balance: 0, icon: '/usd-coin-usdc-logo.svg' },
      ];
    }

    // Parse balances
    const idrxValue = idrxBalance?.value
      ? Number.parseFloat(formatUnits(idrxBalance.value, IDRX_DECIMALS))
      : lastKnownBalances.current.idrx || 0;

    const usdcValue = usdcBalance?.value
      ? Number.parseFloat(formatUnits(usdcBalance.value, USDC_DECIMALS))
      : lastKnownBalances.current.usdc || 0;

    // Update last known balances
    if (idrxBalance?.value) {
      lastKnownBalances.current.idrx = idrxValue;
    }

    if (usdcBalance?.value) {
      lastKnownBalances.current.usdc = usdcValue;
    }

    return [
      {
        symbol: 'IDRX',
        name: 'IDRX Token',
        balance: idrxValue,
        icon: '/IDRX BLUE COIN.svg'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: usdcValue,
        icon: '/usd-coin-usdc-logo.svg'
      },
    ];
  }, [isConnected, idrxBalance?.value, usdcBalance?.value]);

  // Update tokens when balances change
  useEffect(() => {
    setIsLoading(isLoadingUsdc || isLoadingIdrx);

    if (!isLoadingUsdc && !isLoadingIdrx) {
      setTokens(memoizedTokens);
    }
  }, [isLoadingUsdc, isLoadingIdrx, memoizedTokens]);

  return {
    tokens,
    isLoading,
    usdcBalance,
    idrxBalance,
  };
}
