import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Gift, Clock, Users, RefreshCcw, AlertTriangle, Check, Shuffle, Coins, Share2, QrCode } from 'lucide-react';
import { formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { type DropInfo } from '@/hooks/useOptimizedStraptDrop';
import { generateDropClaimLink } from '@/utils/qr-code-utils';

interface DropCardProps {
  id: string;
  info: DropInfo;
  tokenSymbol: string;
  tokenDecimals: number;
  onRefund: (id: string) => Promise<void>;
  onShowQR: (link: string) => void;
  isRefunding: boolean;
  index: number;
}

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
const formatAmount = (amount: bigint, decimals: number) => {
  return formatUnits(amount, decimals);
};

// Check if a drop can be refunded
const canRefund = (drop: DropInfo) => {
  return drop.isActive && isExpired(drop.expiryTime) && drop.remainingAmount > 0n;
};

const DropCard = memo(({
  id,
  info,
  tokenSymbol,
  tokenDecimals,
  onRefund,
  onShowQR,
  isRefunding,
  index
}: DropCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefundingLocal, setIsRefundingLocal] = useState(false);

  const handleRefund = async () => {
    try {
      setIsRefundingLocal(true);
      await onRefund(id);
    } finally {
      setIsRefundingLocal(false);
    }
  };

  const generateDropLink = () => {
    // Use the utility function for consistent drop links
    return generateDropClaimLink(id);
  };

  const handleCopyLink = () => {
    const link = generateDropLink();

    navigator.clipboard.writeText(link)
      .then(() => toast.success('Link copied to clipboard'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const handleShowQR = () => {
    const link = generateDropLink();
    onShowQR(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5 }}
    >
      <Card className={`h-full flex flex-col ${info.isActive
        ? 'dark:border-primary/20 dark:bg-black/40 border-primary/30 bg-primary/5 shadow-md'
        : 'dark:opacity-80 dark:border-muted/50 dark:bg-black/20 opacity-90 border-muted/30 bg-muted/10'}`}>
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {info.isActive ? 'Active Drop' : 'Inactive Drop'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {info.isActive && !isExpired(info.expiryTime) ? 'Active' : 'Inactive'}
              </span>
              <div className={`w-2 h-2 rounded-full ${info.isActive && !isExpired(info.expiryTime) ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
          <CardDescription className="text-xs mt-1">
            Created {new Date(Number(info.expiryTime) * 1000 - 24 * 60 * 60 * 1000).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-2 px-4 flex-grow">
          <div>
            <p className="font-bold text-xl">
              {formatAmount(info.totalAmount, tokenDecimals)} {tokenSymbol || 'tokens'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center text-xs text-muted-foreground">
                <Users className="h-3 w-3 mr-1" />
                {info.totalRecipients.toString()} recipients
              </div>
              <div className="flex items-center text-xs">
                {info.isRandom ? (
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
              <div className={`text-xs font-medium ${isExpired(info.expiryTime) ? 'text-destructive' : ''}`}>
                {formatExpiryTime(info.expiryTime)}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Users className="h-3 w-3" /> Claims
              </div>
              <div className="text-xs font-medium">
                {info.claimedCount.toString()} / {info.totalRecipients.toString()}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">
              Remaining
            </div>
            <div className="text-xs font-medium">
              {formatAmount(info.remainingAmount, tokenDecimals)} {tokenSymbol || 'tokens'}
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-4 pt-2 pb-4">
          {canRefund(info) ? (
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                className="w-full"
                onClick={handleRefund}
                disabled={isRefundingLocal || isRefunding}
              >
                {isRefundingLocal || isRefunding ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Refunding...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refund Expired Drop
                  </>
                )}
              </Button>
            </motion.div>
          ) : info.isActive && !isExpired(info.expiryTime) ? (
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowQR}
              >
                <QrCode className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/strapt-drop/claim?id=${id}`)}
              >
                <Gift className="h-4 w-4" />
              </Button>
            </div>
          ) : !info.isActive && info.claimedCount >= info.totalRecipients ? (
            <div className="w-full flex items-center justify-center text-sm text-muted-foreground py-2 bg-muted/20 rounded-lg">
              <Check className="h-4 w-4 mr-2 text-green-500" /> All tokens claimed
            </div>
          ) : !info.isActive && Number(info.remainingAmount) === 0 ? (
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
  );
});

DropCard.displayName = 'DropCard';

export default DropCard;
