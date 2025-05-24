import { CheckIcon, ChevronDown } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Token color mapping for dynamic styling
const TOKEN_COLORS = {
  'USDC': {
    bg: 'bg-blue-100',
    bgDark: 'dark:bg-blue-900/30',
    text: 'text-blue-700',
    textDark: 'dark:text-blue-100',
    border: 'border-blue-500',
    borderDark: 'dark:border-blue-400',
  },
  'IDRX': {
    bg: 'bg-purple-100',
    bgDark: 'dark:bg-purple-900/30',
    text: 'text-purple-700',
    textDark: 'dark:text-purple-100',
    border: 'border-purple-500',
    borderDark: 'dark:border-purple-400',
  },
  // Add more tokens here in the future
};

export interface TokenOption {
  symbol: string;
  name: string;
  icon?: string;
  balance?: number;
}

interface TokenSelectProps {
  tokens: TokenOption[];
  selectedToken: TokenOption;
  onTokenChange: (token: TokenOption) => void;
  className?: string;
  isLoading?: boolean;
}

const TokenSelect = ({ tokens, selectedToken, onTokenChange, className, isLoading }: TokenSelectProps) => {
  const [open, setOpen] = useState(false);

  // Helper function to get token colors or default colors
  const getTokenColors = useCallback((symbol: string) => {
    return TOKEN_COLORS[symbol as keyof typeof TOKEN_COLORS] || {
      bg: 'bg-gray-100',
      bgDark: 'dark:bg-gray-800',
      text: 'text-gray-700',
      textDark: 'dark:text-gray-300',
      border: 'border-gray-400',
      borderDark: 'dark:border-gray-600',
    };
  }, []);

  // Get colors for the selected token
  const selectedTokenColors = useMemo(() =>
    getTokenColors(selectedToken.symbol),
    [selectedToken.symbol, getTokenColors]
  );

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-9 text-sm px-3",
              selectedTokenColors.border,
              selectedTokenColors.borderDark,
              selectedTokenColors.text,
              selectedTokenColors.textDark,
              className
            )}
            disabled={isLoading}
          >
            <div className="flex items-center">
              {selectedToken.icon && (
                <div className={cn(
                  "mr-2 h-5 w-5 overflow-hidden rounded-full",
                  selectedTokenColors.bg,
                  selectedTokenColors.bgDark
                )}>
                  <img src={selectedToken.icon} alt={selectedToken.name} className="h-full w-full object-cover" />
                </div>
              )}
              <span className="font-medium">{selectedToken.symbol}</span>
            </div>
            <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[170px] p-0">
          <Command>
            <CommandList>
              <CommandGroup>
                {tokens.map((token) => (
                  <CommandItem
                    key={token.symbol}
                    onSelect={() => {
                      onTokenChange(token);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center py-2",
                      getTokenColors(token.symbol).bg,
                      getTokenColors(token.symbol).bgDark
                    )}
                  >
                    {token.icon && (
                      <div className={cn(
                        "mr-2 h-4 w-4 overflow-hidden rounded-full",
                        "bg-white",
                        token.symbol === 'USDC' && "dark:bg-blue-800",
                        token.symbol === 'IDRX' && "dark:bg-purple-800"
                      )}>
                        <img src={token.icon} alt={token.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <span className={cn(
                      "flex-1 font-medium text-sm",
                      getTokenColors(token.symbol).text,
                      getTokenColors(token.symbol).textDark
                    )}>{token.symbol}</span>
                    {token.symbol === selectedToken.symbol && (
                      <CheckIcon className={cn(
                        "ml-1 h-4 w-4",
                        getTokenColors(token.symbol).text,
                        getTokenColors(token.symbol).textDark
                      )} />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TokenSelect;
