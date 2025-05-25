import { useState, useEffect } from 'react';
import { ArrowLeft, Send, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TransferProvider, useTransferContext } from '@/contexts/TransferContext';
import RecipientDetailsForm from '@/components/transfer/RecipientDetailsForm';
import ProtectionOptionsForm from '@/components/transfer/ProtectionOptionsForm';
import ConfirmTransferForm from '@/components/transfer/ConfirmTransferForm';
import TransferSuccessView from '@/components/transfer/TransferSuccessView';
import TransferQRCode from '@/components/transfer/TransferQRCode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Inner component to access context
const TransferContent = () => {
  const [step, setStep] = useState(1);
  const [showQR, setShowQR] = useState(false);
  const { toast } = useToast();
  const {
    transferType,
    setTransferType,
    recipient,
    amount,
    selectedToken,
    withPassword
  } = useTransferContext();

  // Set the initial transfer type to 'direct' when the component mounts
  useEffect(() => {
    setTransferType('direct');
  }, [setTransferType]);

  const nextStep = () => {
    setStep(step + 1);
    window.scrollTo(0, 0);
  };

  // Skip protection options step for direct transfers
  useEffect(() => {
    if (step === 2 && transferType === 'direct') {
      setStep(step + 1); // Skip to confirmation step
      window.scrollTo(0, 0);
    }
  }, [step, transferType]);

  const prevStep = () => {
    // If we're at the confirmation step and this is a direct transfer,
    // go back to step 1 (skip protection options)
    if (step === 3 && transferType === 'direct') {
      setStep(1);
    } else {
      setStep(step - 1);
    }
  };

  const resetTransfer = () => {
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      nextStep();
    } else {
      // This is handled in handleConfirm
    }
  };

  const handleConfirm = () => {
    // The actual transfer is now handled in ConfirmTransferForm
    // using createProtectedTransfer or createProtectedLinkTransfer

    // Show appropriate success notification based on transfer type
    if (transferType === 'direct') {
      toast({
        title: "Transfer Successful",
        description: `${amount} ${selectedToken.symbol} has been sent to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`,
      });
    } else if (transferType === 'claim') {
      toast({
        title: "Transfer Created",
        description: withPassword
          ? `Password-protected transfer of ${amount} ${selectedToken.symbol} is ready to share`
          : `Transfer of ${amount} ${selectedToken.symbol} is ready to share`,
      });
    }

    // Move to success screen
    nextStep();
  };

  const handleShowQR = () => {
    setShowQR(true);
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    if (tab === 'send') {
      setTransferType('direct');
    } else if (tab === 'claim') {
      setTransferType('claim');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        {step > 1 && step < 4 && (
          <Button variant="ghost" size="sm" onClick={prevStep} className="mr-4 p-0 h-auto">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-xl font-semibold">
          {step === 1 && "Transfer Tokens"}
          {step === 2 && "Protection Options"}
          {step === 3 && "Confirm Transfer"}
          {step === 4 && "Transfer Created"}
        </h1>
      </div>

      {step === 1 ? (
        <Tabs
          defaultValue="send"
          value={transferType === 'direct' ? 'send' : 'claim'}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span>Direct Transfer</span>
            </TabsTrigger>
            <TabsTrigger value="claim" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span>Link/QR Transfer</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-0">
            <form onSubmit={handleSubmit}>
              <RecipientDetailsForm onNext={nextStep} hideTransferMethod={true} />
            </form>
          </TabsContent>

          <TabsContent value="claim" className="mt-0">
            <form onSubmit={handleSubmit}>
              <RecipientDetailsForm onNext={nextStep} hideTransferMethod={true} />
            </form>
          </TabsContent>
        </Tabs>
      ) : (
        <form onSubmit={handleSubmit}>
          {step === 2 && transferType === 'claim' && (
            <ProtectionOptionsForm onNext={nextStep} />
          )}

          {step === 3 && (
            <ConfirmTransferForm onSubmit={handleConfirm} />
          )}

          {step === 4 && (
            <TransferSuccessView
              onReset={resetTransfer}
              onShowQR={handleShowQR}
            />
          )}
        </form>
      )}

      <TransferQRCode
        showQR={showQR}
        onOpenChange={setShowQR}
      />
    </div>
  );
};

// Wrapper component to provide context
const Transfer = () => {
  return (
    <TransferProvider>
      <TransferContent />
    </TransferProvider>
  );
};

export default Transfer;
