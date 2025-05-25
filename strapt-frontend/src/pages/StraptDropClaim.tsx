import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop } from '@/hooks/use-strapt-drop';
import type { DropInfo } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Clock, Users, AlertTriangle, Check, Shuffle, Coins, PartyPopper, QrCode, ChevronLeft } from 'lucide-react';
import { formatUnits } from 'viem';
import contractConfig from '@/contracts/contract-config.json';
import QRCodeScanner from '@/components/QRCodeScanner';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const StraptDropClaim = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const { getDropInfo, claimDrop, hasAddressClaimed, isLoading, isClaiming } = useStraptDrop();

  // State
  const [dropId, setDropId] = useState<string | null>(null);
  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [hasClaimed, setHasClaimed] = useState<boolean>(false);
  const [isLoadingDrop, setIsLoadingDrop] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [tokenSymbol, setTokenSymbol] = useState<string>('Token');
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [claimAmount, setClaimAmount] = useState<bigint | null>(null);

  // Parse drop ID from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      setDropId(id);
    }
  }, [location]);

  // Load drop info when ID is available
  useEffect(() => {
    if (dropId && isConnected) {
      loadDropInfo();
    }
  }, [dropId, isConnected]);

  // Load drop info
  const loadDropInfo = async () => {
    if (!dropId) return;

    try {
      setIsLoadingDrop(true);

      // Get drop info
      const info = await getDropInfo(dropId);
      setDropInfo(info);

      // Determine token symbol and decimals
      const tokenAddress = info.tokenAddress.toLowerCase();
      const idrxAddress = contractConfig.StraptDrop.supportedTokens.IDRX.toLowerCase();
      const usdcAddress = contractConfig.StraptDrop.supportedTokens.USDC.toLowerCase();

      if (tokenAddress === idrxAddress) {
        setTokenSymbol('IDRX');
        setTokenDecimals(2);
      } else if (tokenAddress === usdcAddress) {
        setTokenSymbol('USDC');
        setTokenDecimals(6);
      }

      // Check if user has already claimed
      if (address) {
        const claimed = await hasAddressClaimed(dropId, address);
        setHasClaimed(claimed);
      }
    } catch (error) {
      console.error('Error loading drop info:', error);
      toast({
        title: 'Error',
        description: 'Failed to load drop information'
      });
    } finally {
      setIsLoadingDrop(false);
    }
  };

  // Check if user is the creator and drop is less than 24 hours old
  const isCreatorWithinCooldown = (info: DropInfo): boolean => {
    if (!address || !info) return false;

    // Check if user is the creator
    const isCreator = info.creator.toLowerCase() === address.toLowerCase();

    if (!isCreator) return false;

    // Check if drop is less than 24 hours old
    const dropCreationTime = Number(info.expiryTime) - (24 * 60 * 60); // Assuming expiryTime is set to creation time + expiry hours
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceCreation = currentTime - dropCreationTime;
    const cooldownPeriod = 24 * 60 * 60; // 24 hours in seconds

    return timeSinceCreation < cooldownPeriod;
  };

  // State for success animation
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Function to trigger confetti
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0, 0.2) }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0, 0.2) }
      });
    }, 250);
  };

  // Handle claim
  const handleClaim = async () => {
    if (!dropId || !isConnected || !address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to claim tokens'
      });
      return;
    }

    if (dropInfo && isCreatorWithinCooldown(dropInfo)) {
      toast({
        title: 'Creator Cooldown',
        description: 'As the creator, you cannot claim from your own drop within 24 hours of creation'
      });
      return;
    }

    try {
      const amount = await claimDrop(dropId);
      setClaimAmount(amount);
      setHasClaimed(true);

      // Show success animation
      setShowSuccessAnimation(true);

      // Trigger confetti
      triggerConfetti();

      // Hide success animation after 5 seconds
      setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 5000);

      toast({
        title: 'Success',
        description: 'Successfully claimed tokens!'
      });
    } catch (error) {
      console.error('Error claiming drop:', error);

      // Handle specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('DropNotActive')) {
        toast({
          title: 'Error',
          description: 'This drop is no longer active'
        });
      } else if (errorMessage.includes('DropExpired')) {
        toast({
          title: 'Error',
          description: 'This drop has expired'
        });
      } else if (errorMessage.includes('AllClaimsTaken')) {
        toast({
          title: 'Error',
          description: 'All claims for this drop have been taken'
        });
      } else if (errorMessage.includes('AlreadyClaimed')) {
        toast({
          title: 'Error',
          description: 'You have already claimed from this drop'
        });
        setHasClaimed(true);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to claim tokens'
        });
      }
    }
  };

  // Handle QR code scan
  const handleQRScan = (data: string) => {
    try {
      const url = new URL(data);
      const params = new URLSearchParams(url.search);
      const id = params.get('id');

      if (id) {
        setDropId(id);
        setShowScanner(false);
      } else {
        toast({
          title: 'Error',
          description: 'Invalid QR code'
        });
      }
    } catch (error) {
      console.error('Error parsing QR code:', error);
      toast({
        title: 'Error',
        description: 'Invalid QR code'
      });
    }
  };

  // Format expiry time
  const formatExpiryTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  // Check if drop is expired
  const isExpired = (timestamp: bigint) => {
    return Date.now() > Number(timestamp) * 1000;
  };

  return (
    <div className="container max-w-4xl mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/strapt-drop')}
            className="mr-1 p-2"
            aria-label="Back to STRAPT Drop"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Claim STRAPT Drop</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScanner(true)}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Scan QR Code
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/app/strapt-drop')}
          >
            <Gift className="h-4 w-4 mr-2" />
            Create Drop
          </Button>
        </div>
      </div>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-card rounded-xl p-8 flex flex-col items-center max-w-md mx-4"
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.7, 1] }}
              >
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <PartyPopper className="h-10 w-10 text-green-500" />
                </div>
              </motion.div>
              <motion.h2
                className="text-xl font-bold mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Congratulations!
              </motion.h2>
              <motion.p
                className="text-center text-muted-foreground mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                You've successfully claimed tokens from this STRAPT Drop!
              </motion.p>
              {claimAmount && (
                <motion.div
                  className="bg-primary/10 rounded-lg p-4 mb-4 w-full text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-sm text-muted-foreground">You received</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatUnits(claimAmount, tokenDecimals)} {tokenSymbol}
                  </p>
                </motion.div>
              )}
              <motion.button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => setShowSuccessAnimation(false)}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-muted/50 dark:border-muted/70 bg-card/80 dark:bg-card/60 shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10 px-4 sm:px-6 text-center">
              <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4 sm:mb-6" />
              <p className="text-lg sm:text-xl font-medium mb-2">Wallet Not Connected</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">Please connect your wallet to claim tokens from a STRAPT Drop</p>
              <Button size="lg" className="px-8">
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : !dropId ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-muted/50 dark:border-muted/70 bg-card/80 dark:bg-card/60 shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10 px-4 sm:px-6 text-center">
              <Gift className="h-12 w-12 sm:h-16 sm:w-16 text-primary/70 mb-4 sm:mb-6" />
              <p className="text-lg sm:text-xl font-medium mb-2">No Drop ID Provided</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">Please scan a QR code or use a link to claim tokens</p>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/app/strapt-drop')}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : isLoadingDrop ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20">
          <Loading size="lg" />
          <p className="mt-4 text-muted-foreground animate-pulse">Loading drop information...</p>
        </div>
      ) : !dropInfo ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10 px-4 sm:px-6 text-center">
              <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4 sm:mb-6" />
              <p className="text-lg sm:text-xl font-medium mb-2">Drop Not Found</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">The STRAPT Drop you're looking for doesn't exist or has been removed</p>
              <Button
                variant="outline"
                onClick={() => navigate('/app/strapt-drop')}
              >
                Create a New Drop
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl mx-auto"
        >
          <Card className="overflow-hidden border border-primary/20 dark:border-primary/30 bg-card/90 dark:bg-card/70 shadow-lg">
            <CardHeader className="bg-muted/20 dark:bg-muted/30 border-b border-muted/30 dark:border-muted/40 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gift className="h-6 w-6 text-primary" />
                STRAPT Drop
              </CardTitle>
              <CardDescription className="text-base">
                {dropInfo.message || "Claim your tokens from this STRAPT Drop"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Drop Status */}
              <div className="flex justify-between items-center p-4 bg-muted/20 dark:bg-muted/30 border border-muted/30 dark:border-muted/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <motion.div
                    className={`w-3 h-3 rounded-full ${dropInfo.isActive && !isExpired(dropInfo.expiryTime) ? 'bg-green-500' : 'bg-red-500'}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <span className="font-medium">Status:</span>
                </div>
                <span className="font-medium">
                  {!dropInfo.isActive ? 'Inactive' :
                   isExpired(dropInfo.expiryTime) ? 'Expired' : 'Active'}
                </span>
              </div>

              {/* Drop Details */}
              <div className="grid grid-cols-2 gap-6">
                <motion.div
                  className="flex flex-col gap-1 bg-muted/10 dark:bg-muted/20 border border-muted/30 dark:border-muted/40 p-4 rounded-lg"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="text-sm text-muted-foreground">Token</span>
                  <span className="font-medium text-lg">{tokenSymbol}</span>
                </motion.div>
                <motion.div
                  className="flex flex-col gap-1 bg-muted/10 dark:bg-muted/20 border border-muted/30 dark:border-muted/40 p-4 rounded-lg"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="text-sm text-muted-foreground">Distribution</span>
                  <span className="font-medium text-lg flex items-center gap-1">
                    {dropInfo.isRandom ? (
                      <>
                        <Shuffle className="h-4 w-4" /> Random
                      </>
                    ) : (
                      <>
                        <Coins className="h-4 w-4" /> Fixed
                      </>
                    )}
                  </span>
                </motion.div>
                <motion.div
                  className="flex flex-col gap-1 bg-muted/10 dark:bg-muted/20 border border-muted/30 dark:border-muted/40 p-4 rounded-lg"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="text-sm text-muted-foreground">Claimed</span>
                  <span className="font-medium text-lg">{dropInfo.claimedCount.toString()} / {dropInfo.totalRecipients.toString()}</span>
                </motion.div>
                <motion.div
                  className="flex flex-col gap-1 bg-muted/10 dark:bg-muted/20 border border-muted/30 dark:border-muted/40 p-4 rounded-lg"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="font-medium text-lg">{formatExpiryTime(dropInfo.expiryTime)}</span>
                </motion.div>
              </div>

              {/* Claim Status */}
              <AnimatePresence>
                {hasClaimed && (
                  <motion.div
                    className="p-4 bg-green-500/5 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/20 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  >
                    <Check className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">You've claimed from this drop</p>
                      {claimAmount && (
                        <p className="text-sm">
                          Amount: {formatUnits(claimAmount, tokenDecimals)} {tokenSymbol}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error States */}
              <AnimatePresence>
                {!dropInfo.isActive && (
                  <motion.div
                    className="p-4 bg-destructive/5 dark:bg-destructive/10 border border-destructive/30 dark:border-destructive/20 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <p className="font-medium">This drop is no longer active</p>
                  </motion.div>
                )}

                {dropInfo.isActive && isExpired(dropInfo.expiryTime) && (
                  <motion.div
                    className="p-4 bg-destructive/5 dark:bg-destructive/10 border border-destructive/30 dark:border-destructive/20 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Clock className="h-5 w-5 text-destructive" />
                    <p className="font-medium">This drop has expired</p>
                  </motion.div>
                )}

                {dropInfo.isActive && !isExpired(dropInfo.expiryTime) && dropInfo.claimedCount >= dropInfo.totalRecipients && (
                  <motion.div
                    className="p-4 bg-destructive/5 dark:bg-destructive/10 border border-destructive/30 dark:border-destructive/20 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Users className="h-5 w-5 text-destructive" />
                    <p className="font-medium">All claims for this drop have been taken</p>
                  </motion.div>
                )}

                {dropInfo.isActive && !isExpired(dropInfo.expiryTime) && isCreatorWithinCooldown(dropInfo) && (
                  <motion.div
                    className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Clock className="h-5 w-5 text-amber-500" />
                    <p className="font-medium">As the creator, you cannot claim from your own drop within 24 hours of creation</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
            <CardFooter className="pt-2 pb-6 px-6">
              <motion.div
                className="w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  className="w-full text-base py-6"
                  size="lg"
                  disabled={
                    isLoading ||
                    isClaiming ||
                    hasClaimed ||
                    !dropInfo.isActive ||
                    isExpired(dropInfo.expiryTime) ||
                    dropInfo.claimedCount >= dropInfo.totalRecipients ||
                    isCreatorWithinCooldown(dropInfo)
                  }
                  onClick={handleClaim}
                >
                  {isClaiming ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Claiming...
                    </>
                  ) : isLoading ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Processing...
                    </>
                  ) : hasClaimed ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Already Claimed
                    </>
                  ) : (
                    <>
                      <Gift className="h-5 w-5 mr-2" />
                      Claim Tokens
                    </>
                  )}
                </Button>
              </motion.div>
            </CardFooter>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default StraptDropClaim;
