import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { TokenOption } from '@/components/TokenSelect';
import USDCABI from '@/contracts/USDCMock.json';
import IDRXABI from '@/contracts/IDRX.json';

// Contract addresses
const USDC_ADDRESS = USDCABI.address as `0x${string}`;
const IDRX_ADDRESS = IDRXABI.address as `0x${string}`;

// Token decimals
const USDC_DECIMALS = 6;
const IDRX_DECIMALS = 2;

export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  
  // Debug log for wallet connection
  useEffect(() => {
    console.log('Wallet Status:', {
      isConnected,
      address,
      USDC_ADDRESS,
      IDRX_ADDRESS
    });
  }, [isConnected, address]);

  const [tokens, setTokens] = useState<TokenOption[]>([
    { symbol: 'IDRX', name: 'IDRX Token', balance: 0, icon: '/IDRX BLUE COIN.svg' },
    { symbol: 'USDC', name: 'USD Coin', balance: 0, icon: '/usd-coin-usdc-logo.svg' },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Get USDC balance with more frequent updates
  const { data: usdcBalance, isLoading: isLoadingUsdc, error: usdcError } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    query: {
      enabled: isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  // Get IDRX balance with more frequent updates
  const { data: idrxBalance, isLoading: isLoadingIdrx, error: idrxError } = useBalance({
    address: address,
    token: IDRX_ADDRESS,
    query: {
      enabled: isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  });

  // Debug logs for errors
  useEffect(() => {
    if (usdcError) {
      console.error('USDC Balance Error:', usdcError);
    }
    if (idrxError) {
      console.error('IDRX Balance Error:', idrxError);
    }
  }, [usdcError, idrxError]);

  // Debug logs for raw balances
  useEffect(() => {
    console.log('Raw USDC Balance:', {
      value: usdcBalance?.value.toString(),
      formatted: usdcBalance?.formatted,
      decimals: USDC_DECIMALS,
      isLoading: isLoadingUsdc,
      error: usdcError
    });
    console.log('Raw IDRX Balance:', {
      value: idrxBalance?.value.toString(),
      formatted: idrxBalance?.formatted,
      decimals: IDRX_DECIMALS,
      isLoading: isLoadingIdrx,
      error: idrxError
    });
  }, [usdcBalance, idrxBalance, isLoadingUsdc, isLoadingIdrx, usdcError, idrxError]);

  // Update tokens when balances change
  useEffect(() => {
    if (!isConnected) {
      setTokens([
        { symbol: 'IDRX', name: 'IDRX Token', balance: 0, icon: '/IDRX BLUE COIN.svg' },
        { symbol: 'USDC', name: 'USD Coin', balance: 0, icon: '/usd-coin-usdc-logo.svg' },
      ]);
      setIsLoading(false);
      return;
    }

    setIsLoading(isLoadingUsdc || isLoadingIdrx);

    if (!isLoadingUsdc && !isLoadingIdrx) {
      const idrxFormatted = idrxBalance ? Number(formatUnits(idrxBalance.value, IDRX_DECIMALS)) : 0;
      const usdcFormatted = usdcBalance ? Number(formatUnits(usdcBalance.value, USDC_DECIMALS)) : 0;

      // Debug logs for formatted balances
      console.log('Formatted Balances:', {
        IDRX: {
          raw: idrxBalance?.value.toString(),
          formatted: idrxFormatted,
          decimals: IDRX_DECIMALS
        },
        USDC: {
          raw: usdcBalance?.value.toString(),
          formatted: usdcFormatted,
          decimals: USDC_DECIMALS
        }
      });

      // Update tokens with actual blockchain balances
      const updatedTokens = [
        {
          symbol: 'IDRX',
          name: 'IDRX Token',
          balance: idrxFormatted,
          icon: '/IDRX BLUE COIN.svg'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          balance: usdcFormatted,
          icon: '/usd-coin-usdc-logo.svg'
        },
      ];

      // Debug log for token updates
      console.log('Updating tokens with blockchain balances:', updatedTokens);

      setTokens(updatedTokens);
    }
  }, [isConnected, isLoadingUsdc, isLoadingIdrx, usdcBalance, idrxBalance]);

  return {
    tokens,
    isLoading,
    usdcBalance,
    idrxBalance,
  };
}
