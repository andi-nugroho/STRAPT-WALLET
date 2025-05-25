export type TokenType = 'USDC' | 'IDRX';

export interface TokenOption {
  symbol: TokenType;
  name: string;
  balance: number;
  icon: string;
  decimals: number;
  address: `0x${string}`;
}

export interface TokenConfig {
  symbol: TokenType;
  name: string;
  decimals: number;
  address: `0x${string}`;
  icon: string;
}

export interface TokenBalance {
  symbol: TokenType;
  balance: string;
  formatted: string;
} 
