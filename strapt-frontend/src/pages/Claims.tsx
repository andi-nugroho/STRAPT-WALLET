import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, ShieldCheck, Copy, QrCode, LockKeyhole, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import QRCode from '@/components/QRCode';
import QRCodeScanner from '@/components/QRCodeScanner';
import { useAccount } from 'wagmi';
import { useProtectedTransferV2 } from '@/hooks/use-protected-transfer-v2';
import dayjs from 'dayjs';

interface TransferDetails {
  id: string;
  sender: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  expiry: number;
  status: number;
  createdAt: number;
  isLinkTransfer: boolean;
  passwordProtected?: boolean; // For backward compatibility
}

// Utility function to standardize claim code format
const standardizeClaimCode = (code: string): string => {
  // Trim any whitespace and ensure we have a valid string
  if (!code) return '';

  // Remove any special formatting characters that might cause issues
  let formatted = code.trim();

  // Log the processed code for debugging
  console.log(`Standardized claim code from [${code}] to [${formatted}], length: ${formatted.length}`);

  return formatted;
};

const Claims = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address } = useAccount();
  const [showQR, setShowQR] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<TransferDetails | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingClaims, setPendingClaims] = useState<TransferDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualClaimDialog, setShowManualClaimDialog] = useState(false);
  const [manualTransferId, setManualTransferId] = useState('');
  const [manualClaimCode, setManualClaimCode] = useState('');
  const [manualClaimError, setManualClaimError] = useState('');
  const [searchParams] = useSearchParams();

  // Get claim functions from useProtectedTransferV2
  const {
    claimTransfer,
    isPasswordProtected,
    getTransferDetails,
  } = useProtectedTransferV2();

  // Helper function to shorten transfer IDs
  const shortenTransferId = (id: string) => {
    if (!id) return '';
    return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
  };

  // Check for claim ID in URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const claimId = params.get('id');
    const code = params.get('code');

    if (claimId) {
      // If we have a claim code in the URL, show the password dialog
      if (code) {
        setManualTransferId(claimId);
        setManualClaimCode(code);
        setShowPasswordDialog(true);
      } else {
        // Try to claim as a link transfer (no password)
        handleClaimLinkTransfer(claimId);
      }
    }
  }, [location.search]);

  // Process URL parameters on component mount
  useEffect(() => {
    const id = searchParams.get('id');
    const code = searchParams.get('code');

    if (id) {
      console.log(`Processing transfer ID from URL: ${id}, code present: ${!!code}`);
      // Standardize the claim code if present
      const standardizedCode = code ? standardizeClaimCode(code) : '';
      processTransferId(id, standardizedCode);
    }
  }, [searchParams, address]);

  const formatTimeRemaining = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diffSecs = timestamp - now;

    if (diffSecs <= 0) {
      return 'Expired';
    }

    const diffHrs = Math.floor(diffSecs / 3600);
    const diffMins = Math.floor((diffSecs % 3600) / 60);

    return `${diffHrs}h ${diffMins}m`;
  };

  // Handle claiming with password
  const handleClaimWithPassword = async (transferId: string, password: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    setIsValidating(true);
    setPasswordError('');

    try {
      // First check if this transfer requires a password using the contract's isPasswordProtected function
      const requiresPassword = await isPasswordProtected(transferId);
      console.log('Transfer requires password (from contract):', requiresPassword);

      if (requiresPassword) {
        // If it requires a password, use claimTransfer with the password
        if (!password) {
          setPasswordError('Claim code is required for this transfer');
          return false;
        }

        // Ensure claim code is properly formatted
        const cleanPassword = standardizeClaimCode(password);
        console.log('Attempting to claim with password:', cleanPassword, 'length:', cleanPassword.length);

        try {
          const success = await claimTransfer(transferId, cleanPassword);
          if (success) {
            // Get transfer details to show the claimed amount in the success message
            try {
              const details = await getTransferDetails(transferId);
              if (details) {
                toast.success('Password-protected transfer claimed successfully!', {
                  description: `You have received ${details.amount} ${details.tokenSymbol}`
                });
              } else {
                toast.success('Password-protected transfer claimed successfully!');
              }
            } catch (e) {
              // Fallback if we can't get details
              toast.success('Password-protected transfer claimed successfully!');
            }

            setShowPasswordDialog(false);
            setClaimCode('');
            // Refresh the list of pending claims
            // fetchPendingClaims();
            return true;
          }

          setPasswordError('Failed to claim transfer. Please check the password.');
          return false;
        } catch (error) {
          console.error('Error claiming transfer with password:', error);

          // Check for specific InvalidClaimCode error
          if (error.message?.includes('InvalidClaimCode') || error.message?.includes('invalid claim code')) {
            setPasswordError('Invalid password. Please double-check and try again.');
            toast.error('Invalid password', {
              description: 'The password you entered does not match the transfer. Please check for typos or spaces.'
            });
          } else if (error.message?.includes('already claimed')) {
            setPasswordError('This transfer has already been claimed.');
            toast.error('Already claimed', {
              description: 'This transfer has already been claimed and cannot be claimed again.'
            });
          } else {
            setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            toast.error('Claim failed', {
              description: 'An error occurred while claiming the transfer. Please try again.'
            });
          }
          return false;
        }
      }

      // If it doesn't require a password, use claimTransfer with empty password
      toast.info('This transfer does not require a password. Claiming directly...');
      const success = await claimTransfer(transferId, '');
      if (success) {
        toast.success('Transfer claimed successfully!');
        setShowPasswordDialog(false);
        setClaimCode('');
        return true;
      }

      setPasswordError('Failed to claim transfer. Please check the transfer ID.');
      return false;
    } catch (error) {
      console.error('Error claiming transfer:', error);
      setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Handle claiming a link transfer (no password)
  const handleClaimLinkTransfer = async (transferId: string) => {
    if (!address) {
      toast.error('Please connect your wallet to claim this transfer');
      return false;
    }

    setIsLoading(true);

    try {
      // First, check if the transfer requires a password using the contract's isPasswordProtected function
      const requiresPassword = await isPasswordProtected(transferId);
      console.log('Transfer requires password (from contract):', requiresPassword);

      if (requiresPassword) {
        // Get transfer details to show in the password dialog
        const details = await getTransferDetails(transferId);
        if (details) {
          setActiveTransfer({
            id: transferId,
            sender: details.sender,
            recipient: details.recipient,
            tokenAddress: details.tokenAddress,
            tokenSymbol: details.tokenSymbol,
            amount: details.amount,
            expiry: details.expiry,
            status: details.status,
            createdAt: details.createdAt,
            isLinkTransfer: details.isLinkTransfer,
            passwordProtected: true
          });
          setManualTransferId(transferId);
          setShowPasswordDialog(true);
          toast.info('This transfer requires a claim code. Please enter it to proceed.');
          return false; // Don't proceed with claim yet
        }

        toast.error('This transfer requires a claim code. Please enter it to proceed.');
        return false;
      }

      // If no password required, proceed with claim using empty password
      toast.info('Claiming transfer without password...');
      const success = await claimTransfer(transferId, '');

      if (success) {
        // Get transfer details to show in success message
        try {
          const details = await getTransferDetails(transferId);
          if (details) {
            toast.success('Transfer claimed successfully!', {
              description: `You have received ${details.amount} ${details.tokenSymbol}`
            });
          } else {
            toast.success('Transfer claimed successfully!');
          }
        } catch (e) {
          // Fallback if we can't get details
          toast.success('Transfer claimed successfully!');
        }

        // Refresh the list of pending claims
        // fetchPendingClaims();
        return true;
      }

      toast.error('Claim failed', {
        description: 'Could not claim transfer. Please check the transfer ID and try again.'
      });
      return false;
    } catch (error) {
      console.error('Error claiming link transfer:', error);

      // Check for specific errors
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error("Transaction cancelled", {
          description: "You cancelled the claim transaction"
        });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error("Insufficient funds", {
          description: "You do not have enough funds to pay for transaction fees"
        });
      } else if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
        toast.error("Invalid claim code", {
          description: "The claim code you entered is incorrect"
        });
      } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
        toast.error("Transfer not claimable", {
          description: "This transfer has already been claimed or is not available"
        });
      } else {
        toast.error("Claim failed", {
          description: "Could not claim transfer. Please try again."
        });
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowQR = (transfer: TransferDetails) => {
    setActiveTransfer(transfer);
    setShowQR(true);
  };

  const handleCopyLink = (transferId: string) => {
    navigator.clipboard.writeText(`https://truststream.app/claim/${transferId}`);
    toast.success("Link Copied", {
      description: "Transfer link copied to clipboard"
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualTransferId) {
      setPasswordError('Transfer ID is required');
      return;
    }

    // Check if the transfer requires a password
    const requiresPassword = await isPasswordProtected(manualTransferId);

    if (requiresPassword) {
      if (!manualClaimCode) {
        setPasswordError('Claim code is required');
        return;
      }
      await handleClaimWithPassword(manualTransferId, manualClaimCode);
    } else {
      // If no password required, use claimLinkTransfer instead
      setIsValidating(true);
      try {
        // For transfers without password protection, we can claim directly with empty password
        const success = await claimTransfer(manualTransferId, '');
        if (success) {
          // Get transfer details to show in success message
          try {
            const details = await getTransferDetails(manualTransferId);
            if (details) {
              toast.success('Transfer claimed successfully!', {
                description: `You have received ${details.amount} ${details.tokenSymbol}`
              });
            } else {
              toast.success('Transfer claimed successfully!');
            }
          } catch (e) {
            // Fallback if we can't get details
            toast.success('Transfer claimed successfully!');
          }

          setShowPasswordDialog(false);
        }
      } catch (error) {
        console.error('Error claiming transfer:', error);

        // Check for specific errors
        if (error.message?.includes('rejected') || error.message?.includes('denied')) {
          setPasswordError('Transaction cancelled. You cancelled the claim transaction.');
        } else if (error.message?.includes('insufficient funds')) {
          setPasswordError('Insufficient funds. You do not have enough funds to pay for transaction fees.');
        } else if (error.message?.includes('Invalid claim code') || error.message?.includes('invalid password')) {
          setPasswordError('Invalid claim code. The claim code you entered is incorrect.');
        } else if (error.message?.includes('already claimed') || error.message?.includes('not claimable')) {
          setPasswordError('Transfer not claimable. This transfer has already been claimed or is not available.');
        } else {
          setPasswordError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        setIsValidating(false);
      }
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    console.log("Scanned QR code in Claims page:", decodedText);

    try {
      // Check if it's a URL
      if (decodedText.startsWith('http')) {
        const url = new URL(decodedText);

        // Check if it's a claim URL with /claim/ path
        if (url.pathname.includes('/claim/')) {
          const claimId = url.pathname.split('/claim/')[1];
          const params = new URLSearchParams(url.search);
          const code = params.get('code');

          if (claimId) {
            await processTransferId(claimId, code);
            return;
          }
        }

        // Check if URL contains transfer ID in query params
        const params = new URLSearchParams(url.search);
        const transferId = params.get('id') || params.get('transferId');
        const claimCode = params.get('code') || params.get('claimCode');

        if (transferId?.startsWith('0x')) {
          await processTransferId(transferId, claimCode);
          return;
        }
      }

      // Check if it's a JSON string containing transfer data
      if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
        try {
          const jsonData = JSON.parse(decodedText);

          // Check if JSON contains transfer ID
          if (jsonData.id || jsonData.transferId) {
            const transferId = jsonData.id || jsonData.transferId;
            const claimCode = jsonData.code || jsonData.claimCode || jsonData.password;

            if (transferId?.startsWith('0x')) {
              await processTransferId(transferId, claimCode);
              return;
            }
          }
        } catch (e) {
          console.error("Error parsing JSON from QR code:", e);
        }
      }

      // Check if it's a transfer ID (32 bytes hex)
      if (decodedText.startsWith('0x') && decodedText.length === 66) {
        await processTransferId(decodedText);
        return;
      }

      // Check if it contains a transfer ID anywhere in the text
      const hexRegex = /0x[a-fA-F0-9]{64}/;
      const match = decodedText.match(hexRegex);
      if (match) {
        const transferId = match[0];
        await processTransferId(transferId);
        return;
      }

      // If we get here, the format wasn't recognized
      toast.error('Unrecognized QR code format. Please scan a valid transfer QR code.');
    } catch (e) {
      console.error("Error processing QR code:", e);
      toast.error('Invalid QR Code. Could not parse the QR code data');
    }
  };

  // Process a transfer ID from URL or QR code
  const processTransferId = async (transferId: string, claimCode?: string | null) => {
    if (!transferId) {
      toast.error('Invalid transfer ID');
      return;
    }

    // Clean up the transfer ID (remove any URL part if present)
    let cleanTransferId = transferId;
    if (transferId.includes('/')) {
      cleanTransferId = transferId.split('/').pop() || '';
    }

    // If the ID is a full URL, extract just the ID part
    if (cleanTransferId.includes('?id=')) {
      const parts = cleanTransferId.split('?id=');
      cleanTransferId = parts[1]?.split('&')[0] || '';
    }

    console.log('Processing transfer ID:', cleanTransferId);

    if (!cleanTransferId || cleanTransferId.length !== 66) {  // 0x + 64 hex chars
      toast.error('Invalid transfer ID format');
      return;
    }

    // Process the claim code if provided
    let cleanClaimCode = '';
    if (claimCode) {
      // URL decode the claim code if needed
      try {
        // Check if it needs decoding
        if (claimCode.includes('%')) {
          cleanClaimCode = decodeURIComponent(claimCode);
        } else {
          cleanClaimCode = claimCode;
        }

        // Standardize the format
        cleanClaimCode = standardizeClaimCode(cleanClaimCode);
        console.log('Processed claim code:', cleanClaimCode);
      } catch (error) {
        console.error('Error decoding claim code:', error);
        cleanClaimCode = claimCode;
      }
    }

    try {
      // Check if the transfer exists and requires a password
      const isProtected = await isPasswordProtected(cleanTransferId);
      console.log('Transfer is password protected:', isProtected);

      // Get transfer details
      const details = await getTransferDetails(cleanTransferId);

      if (!details) {
        toast.error('Transfer not found or has expired');
        setManualTransferId('');
        setManualClaimCode('');
        return;
      }

      setActiveTransfer({
        ...details,
        passwordProtected: isProtected
      });

      if (isProtected) {
        // Set the values in the password dialog
        setManualTransferId(cleanTransferId);

        // If we have a claim code, pre-fill it
        if (cleanClaimCode) {
          setManualClaimCode(cleanClaimCode);
          setShowPasswordDialog(true);

          // Optionally: automatically submit if both id and code are provided via URL
          // This auto-submission can be enabled/disabled based on UX preferences
          if (cleanTransferId && cleanClaimCode) {
            console.log('Auto-attempting claim with provided password...');
            setTimeout(() => {
              handleClaimWithPassword(cleanTransferId, cleanClaimCode);
            }, 500); // Small delay to let the UI update
          }
        } else {
          // Show password dialog
          setShowPasswordDialog(true);
          toast.info('This transfer requires a password for claiming.');
        }
      } else {
        // For non-password-protected transfers, try to claim directly
        toast.info('Attempting to claim transfer without password...');
        await handleClaimLinkTransfer(cleanTransferId);
      }
    } catch (error) {
      console.error('Error processing transfer ID:', error);
      toast.error('Error processing transfer', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mr-4 p-0 h-auto"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Claim Transfers</h1>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualClaimDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Claim New
          </Button>
          <QRCodeScanner
            buttonVariant="outline"
            buttonSize="sm"
            buttonText="Scan QR"
            onScanSuccess={handleScanSuccess}
          />
        </div>
      </div>

      {pendingClaims.length > 0 ? (
        <div className="space-y-4">
          {pendingClaims.map((claim) => (
            <Card key={claim.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base flex items-center">
                    <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                    Protected Transfer
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {claim.passwordProtected && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <LockKeyhole className="h-3 w-3" />
                        <span>Password</span>
                      </Badge>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>{formatTimeRemaining(claim.expiresAt)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">From:</span>
                    <span className="font-medium">{claim.sender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-medium">{claim.amount} SEI</span>
                  </div>
                  {claim.note && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Note:</span>
                      <span className="font-medium">{claim.note}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="font-medium">{claim.expiresAt.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Button
                  onClick={async () => {
                    if (claim.passwordProtected) {
                      // For password-protected transfers, show the password dialog
                      setActiveTransfer(claim);
                      setManualTransferId(claim.id);
                      setShowPasswordDialog(true);
                    } else {
                      // For non-password protected transfers, claim directly without showing dialog
                      toast.info('Claiming transfer without password...');
                      await handleClaimLinkTransfer(claim.id);
                    }
                  }}
                  className="w-full"
                >
                  {claim.passwordProtected ? (
                    <>
                      <LockKeyhole className="h-4 w-4 mr-1" /> Claim (Password Protected)
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" /> Claim Transfer (No Password)
                    </>
                  )}
                </Button>
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCopyLink(claim.id)}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleShowQR(claim)}
                  >
                    <QrCode className="h-4 w-4 mr-1" /> Show QR
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No Pending Claims</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have any pending transfers to claim. Use the "Claim New" button to claim a transfer using its ID and claim code, or scan a QR code.
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => setShowManualClaimDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Claim New Transfer
            </Button>
            <Button onClick={() => navigate('/app')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* QR code dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            {activeTransfer && (
              <>
                <QRCode value={`https://truststream.app/claim/${activeTransfer.id}`} size={200} />
                <p className="text-sm text-center text-muted-foreground">
                  Share this QR code to claim {activeTransfer.amount} SEI
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password verification dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeTransfer?.passwordProtected
                ? "Enter Claim Code"
                : "Claim Transfer (No Password Required)"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4">
              {activeTransfer ? (
                <div className="space-y-4">
                  <div className="bg-secondary p-3 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">From:</span>
                      <span className="font-medium">
                        {activeTransfer.sender && activeTransfer.sender.length > 12
                          ? `${activeTransfer.sender.slice(0, 6)}...${activeTransfer.sender.slice(-4)}`
                          : activeTransfer.sender}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Amount:</span>
                      <span className="font-medium">
                        {activeTransfer.amount} {activeTransfer.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transfer ID:</span>
                      <span className="font-mono text-xs">
                        {shortenTransferId(activeTransfer.id)}
                      </span>
                    </div>
                    {activeTransfer.expiry && (
                      <div className="flex justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Expires:</span>
                        <span className="font-medium">
                          {new Date(activeTransfer.expiry * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {activeTransfer.passwordProtected && (
                    <div className="text-center">
                      <p className="text-sm text-amber-500 font-medium flex items-center justify-center">
                        <LockKeyhole className="h-4 w-4 mr-1" />
                        This transfer requires a claim code
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the claim code to claim this transfer
                  </p>
                </div>
              )}

              {/* Only show claim code input if the transfer requires a password */}
              {(!activeTransfer || activeTransfer.passwordProtected) && (
                <div className="space-y-2">
                  <Label htmlFor="claimCode">Claim Code</Label>
                  <Input
                    id="claimCode"
                    value={manualClaimCode}
                    onChange={(e) => setManualClaimCode(e.target.value)}
                    placeholder="Enter the claim code"
                    className={passwordError ? "border-red-500" : ""}
                    disabled={isValidating}
                  />
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isValidating || (activeTransfer?.passwordProtected && !manualClaimCode)}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  activeTransfer?.passwordProtected
                    ? "Claim Transfer"
                    : "Claim Transfer (No Password Required)"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual claim dialog */}
      <Dialog open={showManualClaimDialog} onOpenChange={setShowManualClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim a Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the transfer ID and claim code (if required) to claim a transfer
            </p>

            <div className="space-y-2">
              <Label htmlFor="transferId">Transfer ID</Label>
              <Input
                id="transferId"
                value={manualTransferId}
                onChange={(e) => setManualTransferId(e.target.value)}
                placeholder="Enter transfer ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualClaimCode">Claim Code (only for password-protected transfers)</Label>
              <Input
                id="manualClaimCode"
                value={manualClaimCode}
                onChange={(e) => setManualClaimCode(e.target.value)}
                placeholder="Only needed for password-protected transfers"
              />
              <p className="text-xs text-muted-foreground">
                If the transfer was created without password protection, you can leave this field empty.
              </p>
            </div>

            {/* Button to fetch transfer details */}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!manualTransferId) {
                  setManualClaimError('Transfer ID is required');
                  return;
                }

                setIsLoading(true);
                try {
                  const details = await getTransferDetails(manualTransferId);
                  if (details) {
                    setActiveTransfer({
                      id: manualTransferId,
                      sender: details.sender,
                      recipient: details.recipient,
                      tokenAddress: details.tokenAddress,
                      tokenSymbol: details.tokenSymbol,
                      amount: details.amount,
                      expiry: details.expiry,
                      status: details.status,
                      createdAt: details.createdAt,
                      isLinkTransfer: details.isLinkTransfer,
                      passwordProtected: await isPasswordProtected(manualTransferId)
                    });

                    // Show a toast with the details
                    toast.success('Transfer details loaded');
                  } else {
                    setManualClaimError('Transfer not found. Please check the ID and try again.');
                  }
                } catch (error) {
                  console.error('Error fetching transfer details:', error);
                  setManualClaimError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading || !manualTransferId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Check Transfer Details"
              )}
            </Button>

            {/* Display transfer details if available */}
            {activeTransfer && (
              <div className="bg-secondary p-3 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <span className="font-medium">
                    {activeTransfer.sender && activeTransfer.sender.length > 12
                      ? `${activeTransfer.sender.slice(0, 6)}...${activeTransfer.sender.slice(-4)}`
                      : activeTransfer.sender}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {activeTransfer.amount} {activeTransfer.tokenSymbol}
                  </span>
                </div>
                {activeTransfer.expiry && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {new Date(activeTransfer.expiry * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {activeTransfer.passwordProtected && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-sm text-amber-500 font-medium flex items-center">
                      <LockKeyhole className="h-4 w-4 mr-1" />
                      This transfer requires a claim code
                    </p>
                  </div>
                )}
              </div>
            )}

            {manualClaimError && (
              <p className="text-sm text-red-500">{manualClaimError}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowManualClaimDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  setManualClaimError('');

                  if (!manualTransferId) {
                    setManualClaimError('Transfer ID is required');
                    return;
                  }

                  // Show a helpful message about password protection
                  toast.info('Checking if this transfer requires a password...');

                  try {
                    // First, get transfer details to show the user what they're claiming
                    const details = await getTransferDetails(manualTransferId);
                    if (!details) {
                      setManualClaimError('Transfer not found. Please check the ID and try again.');
                      return;
                    }

                    // Check if transfer requires password
                    const requiresPassword = await isPasswordProtected(manualTransferId);
                    console.log('Transfer requires password:', requiresPassword);

                    if (requiresPassword) {
                      if (!manualClaimCode) {
                        // If password is required but not provided, show password dialog
                        setActiveTransfer({
                          id: manualTransferId,
                          sender: details.sender,
                          recipient: details.recipient,
                          tokenAddress: details.tokenAddress,
                          tokenSymbol: details.tokenSymbol,
                          amount: details.amount,
                          expiry: details.expiry,
                          status: details.status,
                          createdAt: details.createdAt,
                          isLinkTransfer: details.isLinkTransfer,
                          passwordProtected: true
                        });

                        toast.info('This transfer requires a claim code. Please enter it to proceed.');
                        setShowManualClaimDialog(false);
                        setShowPasswordDialog(true);
                        return;
                      }

                      // If password is required and provided, use it
                      const success = await handleClaimWithPassword(manualTransferId, manualClaimCode);
                      if (success) {
                        setShowManualClaimDialog(false);
                        setManualTransferId('');
                        setManualClaimCode('');
                      }
                      return;
                    }

                    // If no password required, claim directly without password
                    setActiveTransfer({
                      id: manualTransferId,
                      sender: details.sender,
                      recipient: details.recipient,
                      tokenAddress: details.tokenAddress,
                      tokenSymbol: details.tokenSymbol,
                      amount: details.amount,
                      expiry: details.expiry,
                      status: details.status,
                      createdAt: details.createdAt,
                      isLinkTransfer: details.isLinkTransfer,
                      passwordProtected: false
                    });

                    toast.info('This transfer does not require a password. Claiming directly...');
                    const success = await claimTransfer(manualTransferId, '');
                    if (success) {
                      // Get transfer details to show the claimed amount in the success message
                      try {
                        const details = await getTransferDetails(manualTransferId);
                        if (details) {
                          toast.success('Transfer claimed successfully! (No password was required)', {
                            description: `You have received ${details.amount} ${details.tokenSymbol}`
                          });
                        } else {
                          toast.success('Transfer claimed successfully! (No password was required)');
                        }
                      } catch (e) {
                        // Fallback if we can't get details
                        toast.success('Transfer claimed successfully! (No password was required)');
                      }

                      setShowManualClaimDialog(false);
                      setManualTransferId('');
                      setManualClaimCode('');
                    }
                  } catch (error) {
                    console.error('Error in manual claim:', error);
                    setManualClaimError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                disabled={isLoading || isValidating}
              >
                {isLoading || isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  "Claim Transfer"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Claims;
