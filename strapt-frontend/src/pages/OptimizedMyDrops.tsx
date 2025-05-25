import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useOptimizedStraptDrop } from '@/hooks/useOptimizedStraptDrop';
import { Loading } from '@/components/ui/loading';
import { Gift, RefreshCcw, AlertTriangle, ChevronLeft, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import QRCode from '@/components/QRCode';
import DropCard from '@/components/drops/DropCard';
import InfoTooltip from '@/components/InfoTooltip';
import { Card, CardContent } from '@/components/ui/card';
import { generateDropClaimLink } from '@/utils/qr-code-utils';

const OptimizedMyDrops = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useXellarWallet();
  const {
    getUserCreatedDrops,
    refundExpiredDrop,
    isRefunding,
    isLoadingUserDrops,
    userDrops,
    tokenMetadata
  } = useOptimizedStraptDrop();

  const [refundingDrops, setRefundingDrops] = useState<{[key: string]: boolean}>({});
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
      await getUserCreatedDrops();
    } catch (error) {
      console.error('Error loading user drops:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your drops'
      });
    }
  };

  // Handle refund
  const handleRefund = useCallback(async (dropId: string) => {
    if (!isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to refund this drop'
      });
      return;
    }

    try {
      setRefundingDrops(prev => ({ ...prev, [dropId]: true }));

      await refundExpiredDrop(dropId);

      toast({
        title: 'Success',
        description: `Successfully refunded drop`
      });

      // Reload drops after refund
      await loadUserDrops();
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
  }, [isConnected, refundExpiredDrop, toast, loadUserDrops]);

  // Handle showing QR code
  const handleShowQR = useCallback((link: string) => {
    setCurrentQRLink(link);
    setShowQR(true);
  }, []);

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
      ) : userDrops.length === 0 ? (
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
            {userDrops.map((drop, index) => (
              <DropCard
                key={drop.id}
                id={drop.id}
                info={drop.info}
                tokenSymbol={tokenMetadata.symbols[drop.id] || 'Token'}
                tokenDecimals={tokenMetadata.decimals[drop.id] || 18}
                onRefund={handleRefund}
                onShowQR={handleShowQR}
                isRefunding={isRefunding || !!refundingDrops[drop.id]}
                index={index}
              />
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
            <QRCode value={currentQRLink} size={250} renderAsImage={true} />
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

export default OptimizedMyDrops;
