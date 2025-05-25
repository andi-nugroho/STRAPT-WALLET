import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { useStraptDrop } from '@/hooks/use-strapt-drop';
import type { TokenType } from '@/hooks/use-strapt-drop';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { Loading } from '@/components/ui/loading';
import { Gift, AlertTriangle, Check, Share2, QrCode, Shuffle, Coins, Clock } from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import QRCode from '@/components/QRCode';
import { generateDropClaimLink } from '@/utils/qr-code-utils';
import TokenSelect from '@/components/TokenSelect';

const StraptDrop = () => {
  const navigate = useNavigate();

  const { isConnected, address } = useXellarWallet();
  const { createDrop, isLoading, isApproving, isCreating, currentDropId } = useStraptDrop();
  const { tokens } = useTokenBalances();

  // Form state
  const [tokenType, setTokenType] = useState<TokenType>('IDRX');
  const [amount, setAmount] = useState('');
  const [recipients, setRecipients] = useState('10');
  const [isRandomDistribution, setIsRandomDistribution] = useState(false);
  // Fixed expiry time at 24 hours
  const expiryHours = 24;

  // Find selected token from tokens list
  const selectedToken = tokens.find(token => token.symbol === tokenType) || tokens[0];

  // UI state
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [dropLink, setDropLink] = useState('');

  // Validation
  const [errors, setErrors] = useState<{
    amount?: string;
    recipients?: string;
  }>({});

  // Reset form when navigating away
  useEffect(() => {
    return () => {
      setShowSuccess(false);
      setShowQR(false);
    };
  }, []);

  // Use the utility function for consistent drop links

  // Show success dialog when drop is created
  useEffect(() => {
    if (currentDropId) {
      const link = generateDropClaimLink(currentDropId);
      setDropLink(link);
      setShowSuccess(true);
    }
  }, [currentDropId]);

  // Validate form
  const validateForm = () => {
    const newErrors: {amount?: string; recipients?: string} = {};

    if (!amount || Number.parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    const recipientsNum = Number.parseInt(recipients);
    if (!recipients || recipientsNum <= 0 || recipientsNum > 1000) {
      newErrors.recipients = 'Please enter a valid number of recipients (1-1000)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error('Please connect your wallet to create a STRAPT Drop');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      const result = await createDrop(
        tokenType,
        amount,
        Number.parseInt(recipients),
        isRandomDistribution,
        expiryHours,
        "" // Empty message
      );

      // If result is null, it means either:
      // 1. The user rejected the transaction, or
      // 2. The approval succeeded but the drop creation failed
      // In either case, the hook already showed appropriate messages
      if (result === null) {
        console.log('Transaction was not completed, not showing additional messages');
        return;
      }

      // If we got here, the drop was created successfully
      console.log('Drop created successfully with ID:', result);

      // Generate the drop link
      const baseUrl = window.location.origin;
      const dropLink = `${baseUrl}/app/strapt-drop/claim/${result}`;
      setDropLink(dropLink);

      // Show success toast and dialog
      toast.success('STRAPT Drop created successfully!');
      setShowSuccess(true);
    } catch (error) {
      // Only show error toast if it's not a user rejection
      if (error instanceof Error &&
          !(error.message?.includes('rejected') ||
            error.message?.includes('denied') ||
            error.message?.includes('cancelled') ||
            error.message?.includes('user rejected'))) {
        console.error('Error creating drop:', error);

        // Check if the error message contains information about a specific part of the process
        if (error.message?.includes('insufficient allowance')) {
          toast.error('Insufficient token allowance', {
            description: 'The approval transaction was successful, but the blockchain needs more time to process it. Please wait a moment and try again.'
          });
        } else if (error.message?.includes('approve') || error.message?.includes('allowance')) {
          toast.error('Failed to approve token transfer', {
            description: 'There was an issue with the token approval step. Please try again.'
          });
        } else {
          toast.error('Failed to create STRAPT Drop', {
            description: 'There was an issue creating your drop. Please try again.'
          });
        }
      } else {
        console.log('User rejected transaction, not showing error');
      }
    }
  };

  // Calculate amount per recipient for fixed distribution
  const amountPerRecipient = Number.parseFloat(amount) / Number.parseInt(recipients || '1');

  return (
    <div className="container max-w-4xl mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">Create STRAPT Drop</h1>
          <InfoTooltip
            content={
              <div>
                <p className="font-medium mb-1">About STRAPT Drop</p>
                <p className="mb-1">Create a token drop that can be claimed by multiple recipients.</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>Choose between fixed or random distribution</li>
                  <li>Set expiry time for unclaimed tokens</li>
                  <li>Share via link or QR code</li>
                </ul>
              </div>
            }
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/strapt-drop/my-drops')}
        >
          <Gift className="h-4 w-4 mr-2" />
          My Drops
        </Button>
      </div>

      {!isConnected ? (
        <Card className="border border-muted/50 dark:border-muted/70 bg-card/80 dark:bg-card/60 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 sm:px-6 text-center">
            <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium mb-2">Wallet Not Connected</p>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">Please connect your wallet to create a STRAPT Drop</p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card className="border border-primary/20 dark:border-primary/30 bg-card/90 dark:bg-card/70 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Create New STRAPT Drop
              </CardTitle>
              <CardDescription>
                Distribute tokens to multiple recipients with a single transaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token Selection */}
              <div className="space-y-2">
                <Label htmlFor="token-type">Token</Label>
                <TokenSelect
                  tokens={tokens}
                  selectedToken={selectedToken}
                  onTokenChange={(token) => setTokenType(token.symbol as TokenType)}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="flex justify-between">
                  <span>Total Amount</span>
                  {errors.amount && <span className="text-destructive text-xs">{errors.amount}</span>}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className={errors.amount ? "border-destructive" : ""}
                />
              </div>

              {/* Recipients */}
              <div className="space-y-2">
                <Label htmlFor="recipients" className="flex justify-between">
                  <span>Number of Recipients</span>
                  {errors.recipients && <span className="text-destructive text-xs">{errors.recipients}</span>}
                </Label>
                <Input
                  id="recipients"
                  type="number"
                  placeholder="Enter number of recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  min="1"
                  max="1000"
                  className={errors.recipients ? "border-destructive" : ""}
                />
              </div>

              {/* Distribution Type */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="random-distribution" className="font-medium">Distribution Type</Label>
                    <InfoTooltip content="Choose how tokens will be distributed among recipients" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isRandomDistribution ? 'text-amber-500' : 'text-blue-500'}`}>
                      {isRandomDistribution ? (
                        <span className="flex items-center">
                          <Shuffle className="h-4 w-4 mr-1" /> Random
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Coins className="h-4 w-4 mr-1" /> Fixed
                        </span>
                      )}
                    </span>
                    <Switch
                      id="random-distribution"
                      checked={isRandomDistribution}
                      onCheckedChange={setIsRandomDistribution}
                    />
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${isRandomDistribution
                  ? 'bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20'
                  : 'bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/30 dark:border-blue-500/20'}`}>
                  {isRandomDistribution ? (
                    <div className="flex items-start gap-3">
                      <Shuffle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Random Distribution</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recipients will receive random amounts between 1% and 200% of the average amount.
                          This adds an element of surprise for recipients.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Coins className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Fixed Distribution</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Each recipient will receive exactly the same amount of tokens.
                          {amount && recipients && !Number.isNaN(amountPerRecipient) && (
                            <span className="block mt-1 font-medium">
                              Each recipient will get: {amountPerRecipient.toFixed(6)} {tokenType}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expiry Time */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="expiry-time">Expiry Time</Label>
                  <span className="text-sm font-medium">{expiryHours} hours</span>
                </div>
                <div className="bg-muted/20 dark:bg-muted/30 border border-muted/30 dark:border-muted/40 p-3 rounded-lg flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Fixed at 24 hours</p>
                    <p className="text-xs text-muted-foreground">
                      Unclaimed tokens can be refunded after expiry
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading || isApproving || isCreating}>
                {isApproving ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Approving Token...
                  </>
                ) : isCreating ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Creating Drop...
                  </>
                ) : isLoading ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Create STRAPT Drop
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md bg-card/95 dark:bg-card/90 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              STRAPT Drop Created!
            </DialogTitle>
            <DialogDescription>
              Your STRAPT Drop has been created successfully. Share the link with recipients to let them claim their tokens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Input
                readOnly
                value={dropLink}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(dropLink);
                  toast.success('Link copied to clipboard');
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowQR(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Show QR Code
              </Button>
            </div>
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                navigate('/app/strapt-drop/my-drops');
              }}
            >
              View My Drops
            </Button>
            <Button
              onClick={() => {
                setShowSuccess(false);
                setTokenType('IDRX');
                setAmount('');
                setRecipients('10');
                setIsRandomDistribution(false);
              }}
            >
              Create Another Drop
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md bg-card/95 dark:bg-card/90 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>STRAPT Drop QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to claim tokens from the STRAPT Drop
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <QRCode value={dropLink} size={250} />
          </div>
          <Button
            onClick={() => setShowQR(false)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StraptDrop;
