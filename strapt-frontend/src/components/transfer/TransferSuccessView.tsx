import { Clock, Copy, QrCode, Key, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useTransferContext } from '@/contexts/TransferContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface TransferSuccessViewProps {
  onReset: () => void;
  onShowQR: () => void;
}

const TransferSuccessView = ({ onReset, onShowQR }: TransferSuccessViewProps) => {
  const {
    recipient,
    amount,
    withPassword,
    selectedToken,
    transferType,
    transferLink,
    claimCode,
    transferId,
    shortenTransferId,
  } = useTransferContext();

  // Trigger confetti effect when component mounts
  useEffect(() => {
    triggerConfetti();
  }, []);

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(transferLink);
    toast.success("Link Copied", {
      description: "Transfer link copied to clipboard. Share it with the recipient."
    });
  };

  const handleCopyClaimCode = () => {
    if (claimCode) {
      navigator.clipboard.writeText(claimCode);
      toast.success("Claim Code Copied", {
        description: "Claim code copied to clipboard. Keep it secure and share only with the recipient."
      });
    }
  };

  const handleCopyTransferId = () => {
    if (transferId) {
      navigator.clipboard.writeText(transferId);
      toast.success("Transfer ID Copied", {
        description: "Transfer ID copied to clipboard. The recipient will need this to claim the funds."
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center"
    >
      <Card className="overflow-hidden border-green-500/30 dark:border-green-500/20 shadow-md">
        <CardHeader className="pb-4">
          <motion.div
            className="mx-auto rounded-full bg-green-500/20 p-3 mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, times: [0, 0.7, 1] }}
          >
            <Check className="h-8 w-8 text-green-500" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CardTitle className="text-xl font-bold text-green-600 dark:text-green-500">Transfer Successful!</CardTitle>
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground"
          >
            Your {transferType === 'direct' ? 'direct transfer' : 'protected transfer'} of {amount} {selectedToken.symbol}
            {recipient ? (
              <> to {recipient.length > 12 ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : recipient}</>
            ) : (
              transferType === 'claim' ? ' via Link/QR' : ''
            )} has been {transferType === 'direct' ? 'sent' : 'created'}.
          </motion.p>

          {/* Display fee information */}
          <motion.div
            className="text-sm text-muted-foreground bg-secondary/30 p-4 rounded-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p>No fees are charged for transfers.</p>
            <p className="mt-1">
              <span className="font-medium">Amount:</span> {amount} {selectedToken.symbol}
            </p>
            <p>
              <span className="font-medium">Recipient will receive:</span> {amount} {selectedToken.symbol}
            </p>
          </motion.div>

          {/* Only show claim-related information for claim transfers */}
          {transferType === 'claim' && (
            <motion.div
              className="border border-border rounded-lg p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm text-muted-foreground mb-2">Share this link with the recipient:</p>
              <div className="bg-secondary p-2 rounded text-sm mb-2 overflow-hidden text-ellipsis">
                {transferLink}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-1" /> Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={onShowQR}>
                  <QrCode className="h-4 w-4 mr-1" /> Show QR
                </Button>
              </div>

              {/* Display Transfer ID */}
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground mb-1">Transfer ID:</p>
                <div className="bg-secondary p-2 rounded mb-2 font-mono text-xs overflow-hidden text-ellipsis">
                  {transferId ? shortenTransferId(transferId) : 'Not available'}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyTransferId} className="w-full mb-3" disabled={!transferId}>
                  <Copy className="h-4 w-4 mr-1" /> Copy ID
                </Button>
              </div>

              {/* Display Claim Code if available (only for claim transfers with password) */}
              {withPassword && claimCode && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-center mb-1">
                    <Key className="h-4 w-4 mr-1 text-amber-500" />
                    <p className="text-sm text-amber-500 font-medium">Claim Code (Keep Secure!)</p>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded text-center mb-2">
                    <span className="text-xl font-mono tracking-widest">{claimCode}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyClaimCode} className="w-full">
                    <Copy className="h-4 w-4 mr-1" /> Copy Code
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Share this code securely with the recipient. They will need it to claim the funds.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    <strong>Important:</strong> The password is not included in the link for security. The recipient must enter it manually.
                  </p>
                </div>
              )}

              {/* Display claim instructions */}
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground mb-1">Claim Instructions:</p>
                <p className="text-sm">
                  Recipient should visit: <span className="font-medium">{window.location.origin}/app/claims</span>
                </p>
              </div>
            </motion.div>
          )}

          {transferType === 'claim' && (
            <motion.div
              className="bg-secondary/30 p-3 rounded-md text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center text-amber-500 mb-1">
                <Clock className="h-4 w-4 mr-1" /> Refund Protection Enabled
              </div>
              <p>
                If not claimed within 24 hours, you'll be able to refund the funds back to your wallet.
              </p>
            </motion.div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/app" className="w-full">
              <Button variant="default" className="w-full">
                Back to Home
              </Button>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button variant="outline" className="w-full" onClick={onReset}>
              Create Another Transfer
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default TransferSuccessView;
