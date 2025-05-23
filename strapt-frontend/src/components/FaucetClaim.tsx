
import { useState, useEffect } from 'react';
import { Droplets, Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUSDCFaucet } from '@/hooks/use-usdc-faucet';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/hooks/useTokenUtils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FaucetClaimProps {
  onClose?: () => void;
}

const FaucetClaim = ({ onClose }: FaucetClaimProps) => {
  const { isConnected } = useXellarWallet();
  const {
    isClaiming,
    faucetInfo,
    userClaimInfo,
    claimTokens,
    formatTimeRemaining,
    reloadData
  } = useUSDCFaucet();
  const [claimed, setClaimed] = useState(false);
  const { toast } = useToast();

  const handleClaim = async () => {
    const success = await claimTokens();
    if (success) {
      setClaimed(true);
      // Reset after showing success
      setTimeout(() => {
        setClaimed(false);
        if (onClose) onClose();
      }, 2000);
    }
  };

  // Calculate progress for claim limit
  const claimLimitProgress = userClaimInfo.totalClaimed > 0n && faucetInfo.maxClaimPerAddress > 0n
    ? Number((userClaimInfo.totalClaimed * 100n) / faucetInfo.maxClaimPerAddress)
    : 0;

  // Format claim amount
  const formattedClaimAmount = faucetInfo.claimAmount
    ? formatUnits(faucetInfo.claimAmount, USDC_DECIMALS)
    : '10';

  // Format max claim amount
  const formattedMaxClaimAmount = faucetInfo.maxClaimPerAddress
    ? formatUnits(faucetInfo.maxClaimPerAddress, USDC_DECIMALS)
    : '100';

  // Format total claimed
  const formattedTotalClaimed = userClaimInfo.totalClaimed
    ? formatUnits(userClaimInfo.totalClaimed, USDC_DECIMALS)
    : '0';

  // Check if faucet has sufficient balance
  const hasSufficientBalance = faucetInfo.faucetBalance >= faucetInfo.claimAmount;

  // Log the current state for debugging
  useEffect(() => {
    console.log('FaucetClaim state:', {
      isConnected,
      hasSufficientBalance,
      faucetBalance: faucetInfo.faucetBalance.toString(),
      claimAmount: faucetInfo.claimAmount.toString(),
      canClaim: userClaimInfo.canClaim,
      timeUntilNextClaim: userClaimInfo.timeUntilNextClaim.toString()
    });
  }, [isConnected, hasSufficientBalance, faucetInfo, userClaimInfo]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Droplets className="h-5 w-5 mr-2 text-primary" />
          USDC Testnet Faucet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Claim testnet USDC tokens to try out STRAPT features. These tokens have no real value and are only for testing purposes.
        </p>

        {!isConnected && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to claim tokens
            </AlertDescription>
          </Alert>
        )}

        {!hasSufficientBalance && isConnected && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The faucet is currently out of funds. Please try again later.
            </AlertDescription>
          </Alert>
        )}

        <div className="p-3 bg-secondary/30 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Claim amount:</span>
            <span className="font-medium">{formattedClaimAmount} USDC</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            You can claim once every 24 hours
          </div>
        </div>

        {isConnected && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Claim limit:</span>
                <span className="font-medium">{formattedTotalClaimed} / {formattedMaxClaimAmount} USDC</span>
              </div>
              <Progress value={claimLimitProgress} className="h-2" />
            </div>

            {userClaimInfo.timeUntilNextClaim > 0n && (
              <div className="flex items-center gap-2 text-sm text-amber-500 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                <span>Next claim available in: {formatTimeRemaining(userClaimInfo.timeUntilNextClaim)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleClaim}
          disabled={
            !isConnected ||
            isClaiming ||
            claimed ||
            !userClaimInfo.canClaim ||
            !hasSufficientBalance
          }
        >
          {isClaiming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : claimed ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Claimed!
            </>
          ) : !isConnected ? (
            <>
              <Droplets className="mr-2 h-4 w-4" />
              Connect Wallet to Claim
            </>
          ) : userClaimInfo.timeUntilNextClaim > 0n ? (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Cooldown Active
            </>
          ) : !hasSufficientBalance ? (
            <>
              <AlertCircle className="mr-2 h-4 w-4" />
              Faucet Empty
            </>
          ) : (
            <>
              <Droplets className="mr-2 h-4 w-4" />
              Claim USDC
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FaucetClaim;
