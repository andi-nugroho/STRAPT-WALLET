import React from 'react';
import { Button } from '@/components/ui/button';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { Loader2, Wallet } from 'lucide-react';

interface XellarWalletButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const XellarWalletButton: React.FC<XellarWalletButtonProps> = ({ 
  variant = 'default',
  size = 'default',
  className = '',
  children,
}) => {
  const { 
    isConnected, 
    disconnectWallet, 
    connectWallet,
    address,
  } = useXellarWallet();
  const [isLoading, setIsLoading] = React.useState(false);

  // Format the address for display
  const displayAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
    : '';

  // Handle connection/disconnection
  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (isConnected) {
        await disconnectWallet();
      } else {
        await connectWallet();
      }
    } catch (error) {
      console.error("Wallet operation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Button 
        variant="outline" 
        size={size} 
        className={className} 
        disabled
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <Button 
      variant={isConnected ? 'outline' : variant} 
      size={size} 
      className={className}
      onClick={handleClick}
    >
      {isConnected ? (
        displayAddress
      ) : (
        <>
          {children || (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </>
      )}
    </Button>
  );
};

export default XellarWalletButton;
