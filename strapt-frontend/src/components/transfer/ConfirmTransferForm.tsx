import { Shield, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransferContext } from '@/contexts/TransferContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';

interface ConfirmTransferFormProps {
  onSubmit: () => void;
}

const ConfirmTransferForm = ({ onSubmit }: ConfirmTransferFormProps) => {
  const {
    recipient,
    amount,
    note,
    withPassword,
    selectedToken,
    transferType,
    isLoading,
    isDirectTransferLoading,
    isApproving,
    isApproved,
    approveToken,
    createProtectedTransfer,
    createProtectedLinkTransfer,
  } = useTransferContext();

  // Handle approval only
  const handleApprove = async () => {
    await approveToken();
    // No automatic submission - wait for user to confirm
  };

  // Handle confirmation/transfer
  const handleConfirm = async () => {
    try {
      let success = false;

      // Log debug information
      console.log('Confirming transfer with type:', transferType);
      console.log('Amount:', amount, 'Token:', selectedToken.symbol);
      console.log('Password enabled:', withPassword);

      // Validate inputs before proceeding
      if (!amount || Number.parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      // Only require recipient for direct transfers
      if (transferType === 'direct' && !recipient) {
        toast.error("Please enter a recipient address");
        return;
      }

      // For Link/QR transfers, recipient is optional

      // Call the appropriate transfer function based on transfer type
      if (transferType === 'direct') {
        try {
          // For direct transfers, we can skip approval
          // The createProtectedTransfer function will handle this case
          const result = await createProtectedTransfer();
          console.log('Direct transfer result:', result);
          success = !!result;
        } catch (error) {
          console.error('Error creating direct transfer:', error);
          toast.error(`Failed to create direct transfer: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      } else if (transferType === 'claim') {
        try {
          // Create the link transfer
          const result = await createProtectedLinkTransfer();
          console.log('Link transfer result:', result);
          success = !!result;
        } catch (error) {
          console.error('Error creating link transfer:', error);
          toast.error(`Failed to create link transfer: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      }

      // Only move to success screen if the transfer was successful
      if (success) {
        onSubmit();
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      toast.error(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary" />
          Confirm Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transfer Steps */}
        <div className="mb-2">
          {/* Show special alert for direct transfers */}
          {transferType === 'direct' && !isDirectTransferLoading && (
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <Check className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-blue-700">Instant Direct Transfer</AlertTitle>
              <AlertDescription className="text-blue-600">
                You've selected an instant direct transfer. This will send {selectedToken.symbol} tokens directly to the recipient's
                wallet. The transfer will be immediate and cannot be refunded.
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction Status Alerts - Simplified and Cleaner */}
          {(transferType === 'direct' && isDirectTransferLoading) || isApproving || (transferType !== 'direct' && !isApproved && !isApproving) ? (
            <div className="mt-4 border rounded-lg overflow-hidden">
              {/* Direct Transfer Processing */}
              {transferType === 'direct' && isDirectTransferLoading && (
                <div className="p-4 bg-primary/5 border-b border-primary/10">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <div className="relative">
                        <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                        <div className="absolute top-0 left-0 animate-spin-reverse [animation-delay:-0.2s]">
                          <Loader2 className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Processing Transfer</h4>
                      <p className="text-xs text-muted-foreground">Please wait while your transaction is being processed</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-primary/10 rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              )}

              {/* Token Approval Required */}
              {transferType !== 'direct' && !isApproved && !isApproving && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-3 text-amber-500" />
                    <div>
                      <h4 className="font-medium text-sm">Token Approval Required</h4>
                      <p className="text-xs text-muted-foreground">
                        Approve the contract to use your {selectedToken.symbol} tokens before confirming the transfer
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Token Approval Processing */}
              {isApproving && (
                <div className="p-4 bg-primary/5">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <div className="relative">
                        <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                        <div className="absolute top-0 left-0 animate-spin-reverse [animation-delay:-0.2s]">
                          <Loader2 className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Approving {selectedToken.symbol}</h4>
                      <p className="text-xs text-muted-foreground">Please confirm the approval transaction in your wallet</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-primary/10 rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {isApproved && !isLoading && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className="p-4 bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center">
                  <Check className="h-5 w-5 mr-3 text-green-500" />
                  <div>
                    <h4 className="font-medium text-sm">
                      {transferType === 'direct' ? 'Ready to Transfer' : `${selectedToken.symbol} Approved`}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {transferType === 'direct'
                        ? `You can now send your ${selectedToken.symbol} tokens directly to the recipient.`
                        : 'Your tokens are approved for transfer. You can now confirm your transaction.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="border border-border rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Recipient:</span>
            <span className="font-medium">
              {recipient ? (
                recipient.length > 12
                  ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
                  : recipient
              ) : (
                transferType === 'direct'
                  ? 'Not specified'
                  : 'Anyone with the link/QR code'
              )}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Amount:</span>
            <span className="font-medium">{amount} {selectedToken.symbol}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Method:</span>
            <span className="font-medium">
              {transferType === 'direct'
                ? 'Instant Direct Transfer'
                : 'Claim via Link/QR'}
            </span>
          </div>
          {note && (
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Note:</span>
              <span className="font-medium">{note}</span>
            </div>
          )}
          {/* Auto-refund timeout is always 24 hours, no need to show it in the UI */}
          {transferType !== 'direct' && withPassword && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Password Protected:</span>
              <span className="font-medium">Yes</span>
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Transfer Fee:</span>
            <span className="font-medium">No fee</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total:</span>
            <span>{Number.parseFloat(amount).toFixed(3)} {selectedToken.symbol}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {/* For direct transfers, show transfer button directly */}
        {transferType === 'direct' ? (
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full"
            disabled={isLoading || isDirectTransferLoading}
          >
            {isLoading || isDirectTransferLoading ? (
              <div className="flex items-center justify-center">
                <div className="relative mr-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground/30" />
                  <div className="absolute top-0 left-0 animate-spin-reverse [animation-delay:-0.2s]">
                    <Loader2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <span>Processing Transfer...</span>
              </div>
            ) : (
              "Send Direct Transfer"
            )}
          </Button>
        ) : (
          /* For protected transfers, show approval button first if not approved */
          !isApproved ? (
            <Button
              type="button"
              onClick={handleApprove}
              className="w-full"
              disabled={isApproving || isLoading}
              variant={isApproving ? "outline" : "default"}
            >
              {isApproving ? (
                <div className="flex items-center justify-center">
                  <div className="relative mr-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary/30" />
                    <div className="absolute top-0 left-0 animate-spin-reverse [animation-delay:-0.2s]">
                      <Loader2 className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <span>Approving {selectedToken.symbol}...</span>
                </div>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4 opacity-70" />
                  Approve {selectedToken.symbol}
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConfirm}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="relative mr-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground/30" />
                    <div className="absolute top-0 left-0 animate-spin-reverse [animation-delay:-0.2s]">
                      <Loader2 className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                  <span>Processing Transfer...</span>
                </div>
              ) : (
                "Confirm Protected Transfer"
              )}
            </Button>
          )
        )}
      </CardFooter>
    </Card>
  );
};

export default ConfirmTransferForm;
