import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop, type DropInfo } from '@/hooks/use-strapt-drop';
import { Loading } from '@/components/ui/loading';
import { Gift, Clock, Users, RefreshCcw, AlertTriangle, Check, Shuffle, Coins, Share2, QrCode, ChevronLeft } from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import contractConfig from '@/contracts/contract-config.json';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import QRCode from '@/components/QRCode';

const MyDrops = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const {
    getUserCreatedDrops,
    refundExpiredDrop,
    isLoading,
    isRefunding,
    isLoadingUserDrops
  } = useStraptDrop();

  const [drops, setDrops] = useState<{id: string; info: DropInfo}[]>([]);
  const [refundingDrops, setRefundingDrops] = useState<{[key: string]: boolean}>({});
  const [tokenSymbols, setTokenSymbols] = useState<{[key: string]: string}>({});
  const [tokenDecimals, setTokenDecimals] = useState<{[key: string]: number}>({});
  const [showQR, setShowQR] = useState(false);
  const [currentQRLink, setCurrentQRLink] = useState('');

  // Load user's drops
  useEffect(() => {
    if (isConnected && address) {
      loadUserDrops();
    }
  }, [isConnected, address]);

  // Load user's drops
  const loadUserDrops = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to view your drops'
      });
      return;
    }

    try {
      const userDrops = await getUserCreatedDrops();
      setDrops(userDrops);

      // Determine token symbols and decimals for each drop
      const symbols: {[key: string]: string} = {};
      const decimals: {[key: string]: number} = {};

      for (const drop of userDrops) {
        const tokenAddress = drop.info.tokenAddress.toLowerCase();
        const idrxAddress = contractConfig.StraptDrop.supportedTokens.IDRX.toLowerCase();
        const usdcAddress = contractConfig.StraptDrop.supportedTokens.USDC.toLowerCase();

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

      setTokenSymbols(symbols);
      setTokenDecimals(decimals);
    } catch (error) {
      console.error('Error loading user drops:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your drops'
      });
    }
  };

  // Handle refund
  const handleRefund = async (dropId: string) => {
    if (!isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to refund this drop'
      });
      return;
    }

    try {
      setRefundingDrops(prev => ({ ...prev, [dropId]: true }));

      const amount = await refundExpiredDrop(dropId);

      if (amount) {
        toast({
          title: 'Success',
          description: `Successfully refunded ${amount} ${tokenSymbols[dropId] || 'tokens'}`
        });

        // Reload drops after refund
        await loadUserDrops();
      }
    } catch (error) {
      console.error('Error refunding drop:', error);

      if (error instanceof Error) {
        if (error.message.includes('NotExpiredYet')) {
          toast({
            title: 'Error',
            description: 'This drop has not expired yet'
          });
        } else if (error.message.includes('NotCreator')) {
          toast({
            title: 'Error',
            description: 'Only the creator can refund this drop'
          });
        } else if (error.message.includes('DropNotActive')) {
          toast({
            title: 'Error',
            description: 'This drop is not active'
          });
        } else if (error.message.includes('DropNotFound')) {
          toast({
            title: 'Error',
            description: 'This drop does not exist'
          });
          // Reload drops to remove the non-existent drop from the list
          await loadUserDrops();
        } else {
          toast({
            title: 'Error',
            description: `Error refunding drop: ${error.message}`
          });
        }
      } else {
        toast({
          title: 'Error',
          description: 'An unknown error occurred while refunding the drop'
        });
      }
    } finally {
      setRefundingDrops(prev => ({ ...prev, [dropId]: false }));
    }
  };

  // Format expiry time
  const formatExpiryTime = (expiryTime: bigint) => {
    const expiryTimeNum = Number(expiryTime);
    if (expiryTimeNum <= 0) return 'No expiration';

    const expiryDate = new Date(expiryTimeNum * 1000);
    const now = new Date();

    if (expiryDate <= now) {
      return 'Expired';
    }

    // Calculate time difference in hours
    const diffInHours = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Expires in less than an hour';
    }

    if (diffInHours === 1) {
      return 'Expires in 1 hour';
    }

    return `Expires in ${diffInHours} hours`;
  };

  // Check if a drop is expired
  const isExpired = (expiryTime: bigint) => {
    const expiryTimeNum = Number(expiryTime);
    return expiryTimeNum > 0 && expiryTimeNum * 1000 < Date.now();
  };

  // Format amount with proper decimals
  const formatAmount = (amount: bigint, dropId: string) => {
    const decimals = tokenDecimals[dropId] || 18;
    return formatUnits(amount, decimals);
  };

  // Check if a drop can be refunded
  const canRefund = (drop: DropInfo) => {
    return drop.isActive && isExpired(drop.expiryTime) && drop.remainingAmount > 0n;
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
          <h1 className="text-xl sm:text-2xl font-bold">My STRAPT Drops</h1>
          <InfoTooltip
            content={
              <div>
                <p className="font-medium mb-1">About My STRAPT Drops</p>
                <p className="mb-1">View and manage your created STRAPT Drops.</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>See all drops you've created</li>
                  <li>Refund expired drops that haven't been fully claimed</li>
                  <li>Track claim status of your drops</li>
                </ul>
              </div>
            }
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUserDrops}
            disabled={isLoadingUserDrops}
            className="flex-1 sm:flex-none"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/app/strapt-drop')}
            className="flex-1 sm:flex-none"
          >
            <Gift className="h-4 w-4 mr-2" />
            Create New Drop
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2 border-muted">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10 px-4 sm:px-6 text-center">
              <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4 sm:mb-6" />
              <p className="text-lg sm:text-xl font-medium mb-2">Wallet Not Connected</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">Please connect your wallet to view your STRAPT Drops</p>
              <Button size="lg" className="px-8">
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : isLoadingUserDrops ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 sm:py-20"
        >
          <Loading size="lg" />
          <p className="mt-4 text-muted-foreground animate-pulse">Loading your STRAPT Drops...</p>
        </motion.div>
      ) : drops.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2 border-muted">
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10 px-4 sm:px-6 text-center">
              <Gift className="h-12 w-12 sm:h-16 sm:w-16 text-primary/70 mb-4 sm:mb-6" />
              <p className="text-lg sm:text-xl font-medium mb-2">No STRAPT Drops Found</p>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">You haven't created any STRAPT Drops yet</p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => navigate('/app/strapt-drop')}
                  size="lg"
                  className="px-8"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Create Your First Drop
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          <AnimatePresence>
            {drops.map((drop, index) => (
              <motion.div
                key={drop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -5 }}
              >
                <Card className={`h-full flex flex-col ${drop.info.isActive
                  ? 'dark:border-primary/20 dark:bg-black/40 border-primary/30 bg-primary/5 shadow-md'
                  : 'dark:opacity-80 dark:border-muted/50 dark:bg-black/20 opacity-90 border-muted/30 bg-muted/10'}`}>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">
                          {drop.info.isActive ? 'Active Drop' : 'Inactive Drop'}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {drop.info.isActive && !isExpired(drop.info.expiryTime) ? 'Active' : 'Inactive'}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${drop.info.isActive && !isExpired(drop.info.expiryTime) ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Created {new Date(Number(drop.info.expiryTime) * 1000 - 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-2 px-4 flex-grow">
                    <div>
                      <p className="font-bold text-xl">
                        {formatAmount(drop.info.totalAmount, drop.id)} {tokenSymbols[drop.id] || 'tokens'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Users className="h-3 w-3 mr-1" />
                          {drop.info.totalRecipients.toString()} recipients
                        </div>
                        <div className="flex items-center text-xs">
                          {drop.info.isRandom ? (
                            <>
                              <span className="text-amber-500 mr-1">•</span>
                              <Shuffle className="h-3 w-3 mr-1 text-amber-500" />
                              <span className="text-amber-500">Random</span>
                            </>
                          ) : (
                            <>
                              <span className="text-blue-500 mr-1">•</span>
                              <Coins className="h-3 w-3 mr-1 text-blue-500" />
                              <span className="text-blue-500">Fixed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3" /> Expiry
                        </div>
                        <div className={`text-xs font-medium ${isExpired(drop.info.expiryTime) ? 'text-destructive' : ''}`}>
                          Expires in {formatExpiryTime(drop.info.expiryTime)}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <Users className="h-3 w-3" /> Claims
                        </div>
                        <div className="text-xs font-medium">
                          {drop.info.claimedCount.toString()} / {drop.info.totalRecipients.toString()}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Remaining
                      </div>
                      <div className="text-xs font-medium">
                        {formatAmount(drop.info.remainingAmount, drop.id)} {tokenSymbols[drop.id] || 'tokens'}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="px-4 pt-2 pb-4">
                    {canRefund(drop.info) ? (
                      <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          className="w-full"
                          onClick={() => handleRefund(drop.id)}
                          disabled={refundingDrops[drop.id] || isLoading}
                        >
                          {refundingDrops[drop.id] ? (
                            <>
                              <Loading size="sm" className="mr-2" /> Refunding...
                            </>
                          ) : (
                            <>
                              <RefreshCcw className="h-4 w-4 mr-2" />
                              Refund Expired Drop
                            </>
                          )}
                        </Button>
                      </motion.div>
                    ) : drop.info.isActive && !isExpired(drop.info.expiryTime) ? (
                      <div className="flex gap-2 w-full">
                        <Button
                          className="flex-1"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Generate share link
                            const baseUrl = window.location.origin;
                            const link = `${baseUrl}/app/strapt-drop/claim?id=${drop.id}`;

                            // Copy to clipboard
                            navigator.clipboard.writeText(link)
                              .then(() => toast.success('Link copied to clipboard'))
                              .catch(() => toast.error('Failed to copy link'));
                          }}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const baseUrl = window.location.origin;
                            const link = `${baseUrl}/app/strapt-drop/claim?id=${drop.id}`;
                            setCurrentQRLink(link);
                            setShowQR(true);
                          }}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/strapt-drop/claim?id=${drop.id}`)}
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : !drop.info.isActive && drop.info.claimedCount >= drop.info.totalRecipients ? (
                      <div className="w-full flex items-center justify-center text-sm text-muted-foreground py-2 bg-muted/20 rounded-lg">
                        <Check className="h-4 w-4 mr-2 text-green-500" /> All tokens claimed
                      </div>
                    ) : !drop.info.isActive && Number(drop.info.remainingAmount) === 0 ? (
                      <div className="w-full flex items-center justify-center text-sm text-muted-foreground py-2 bg-muted/20 rounded-lg">
                        <Check className="h-4 w-4 mr-2 text-green-500" /> Drop refunded
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-center text-sm text-muted-foreground py-2 bg-muted/20 rounded-lg">
                        <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" /> Drop inactive
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>STRAPT Drop QR Code</DialogTitle>
            <DialogDescription>
              Share this QR code to let recipients claim tokens from your STRAPT Drop
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <QRCode value={currentQRLink} size={250} />
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setShowQR(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(currentQRLink);
                toast.success('Link copied to clipboard');
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyDrops;
