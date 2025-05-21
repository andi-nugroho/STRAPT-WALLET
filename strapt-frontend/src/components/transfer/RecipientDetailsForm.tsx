
import { Shield, Send, Share2, Scan, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import TokenSelect from '@/components/TokenSelect';
import { ArrowRight } from 'lucide-react';
import { useTransferContext } from '@/contexts/TransferContext';
import QRCodeScanner from '@/components/QRCodeScanner';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RecipientDetailsFormProps {
  onNext: () => void;
  hideTransferMethod?: boolean;
}

const RecipientDetailsForm = ({ onNext, hideTransferMethod = false }: RecipientDetailsFormProps) => {
  const {
    recipient,
    setRecipient,
    amount,
    setAmount,
    selectedToken,
    setSelectedToken,
    transferType,
    setTransferType,
  } = useTransferContext();

  // Validation state
  const [errors, setErrors] = useState<{
    recipient?: string;
    amount?: string;
    general?: string;
  }>({});
  const [touched, setTouched] = useState<{
    recipient: boolean;
    amount: boolean;
  }>({
    recipient: false,
    amount: false
  });

  const location = useLocation();

  // Validation functions
  const validateRecipient = (value: string): string | undefined => {
    if (!value) {
      return "Recipient address is required";
    }

    if (!value.startsWith('0x') || value.length !== 42) {
      return "Invalid Ethereum address format";
    }

    return undefined;
  };

  const validateAmount = (value: string): string | undefined => {
    if (!value) {
      return "Amount is required";
    }

    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
      return "Amount must be a valid number";
    }

    if (numValue <= 0) {
      return "Amount must be greater than 0";
    }

    if (selectedToken.balance && numValue > selectedToken.balance) {
      return `Insufficient balance (max: ${selectedToken.balance} ${selectedToken.symbol})`;
    }

    return undefined;
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: {
      recipient?: string;
      amount?: string;
    } = {};

    // Only validate recipient for direct transfers
    if (transferType === 'direct') {
      const recipientError = validateRecipient(recipient);
      if (recipientError) {
        newErrors.recipient = recipientError;
      }
    }

    const amountError = validateAmount(amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle field blur events to mark fields as touched
  const handleBlur = (field: 'recipient' | 'amount') => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate the specific field
    if (field === 'recipient' && transferType === 'direct') {
      const error = validateRecipient(recipient);
      setErrors(prev => ({ ...prev, recipient: error }));
    } else if (field === 'amount') {
      const error = validateAmount(amount);
      setErrors(prev => ({ ...prev, amount: error }));
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    // Mark all fields as touched
    setTouched({ recipient: true, amount: true });

    // Validate all fields
    if (validateForm()) {
      onNext();
    }
  };

  // Check for recipient in URL query parameters (from QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const toAddress = params.get('to');

    if (toAddress?.startsWith('0x')) {
      setRecipient(toAddress);
      // Automatically set to direct transfer when an address is provided
      setTransferType('direct');
    }
  }, [location.search, setRecipient, setTransferType]);

  // Validate form when transfer type changes
  useEffect(() => {
    // Only validate if fields have been touched
    if (touched.recipient || touched.amount) {
      validateForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferType, touched.recipient, touched.amount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary" />
          {transferType === 'direct' ? 'Direct Transfer Details' : 'Link/QR Transfer Details'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Only show recipient field for direct transfers */}
        {transferType === 'direct' && (
          <div className="space-y-2">
            <label htmlFor="recipient" className="text-sm font-medium">
              Recipient
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="recipient"
                  placeholder="wallet address 0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  onBlur={() => handleBlur('recipient')}
                  required={true}
                  className={touched.recipient && errors.recipient ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
              </div>
              <QRCodeScanner
                buttonVariant="outline"
                buttonSize="icon"
                iconOnly={true}
                onScanSuccess={(result) => {
                  // Check if it's an Ethereum address
                  if (result?.startsWith('0x') && result.length === 42) {
                    setRecipient(result);
                  }
                }}
              />
            </div>
            {touched.recipient && errors.recipient && (
              <p className="text-xs text-red-500 mt-1 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.recipient}
              </p>
            )}
          </div>
        )}

        {/* No explanation text for Link/QR transfers */}

        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-medium">
            Token
          </label>
          <TokenSelect
            tokens={useTransferContext().tokens}
            selectedToken={selectedToken}
            onTokenChange={setSelectedToken}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-medium">
            Amount
          </label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => handleBlur('amount')}
              required
              className={`pr-16 ${touched.amount && errors.amount ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground"
              onClick={() => {
                const balance = selectedToken.balance || 0;
                setAmount(balance.toString());
              }}
            >
              MAX
            </button>
          </div>
          {touched.amount && errors.amount && (
            <p className="text-xs text-red-500 mt-1 flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors.amount}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Available: {selectedToken.balance?.toFixed(2) || 0} {selectedToken.symbol}
          </p>
        </div>

        {/* <div className="space-y-2">
          <label htmlFor="note" className="text-sm font-medium">
            Note (Optional)
          </label>
          <Input
            id="note"
            placeholder="What's this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div> */}

        {!hideTransferMethod && (
          <div className="space-y-2">
            <label htmlFor="transfer-method" className="text-sm font-medium">
              Transfer Method
            </label>
            <RadioGroup
              id="transfer-method"
              value={transferType}
              onValueChange={(value) => setTransferType(value as 'direct' | 'claim')}
              className="grid grid-cols-1 gap-4 pt-2"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-secondary/20">
                <RadioGroupItem value="direct" id="direct" />
                <Label htmlFor="direct" className="flex items-center cursor-pointer">
                  <Send className="h-4 w-4 mr-2 text-primary" />
                  <div>
                    <div className="font-medium">Direct Transfer</div>
                    <div className="text-xs text-muted-foreground">Send tokens directly to recipient</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-secondary/20">
                <RadioGroupItem value="claim" id="claim" />
                <Label htmlFor="claim" className="flex items-center cursor-pointer">
                  <Share2 className="h-4 w-4 mr-2 text-primary" />
                  <div>
                    <div className="font-medium">Claim via Link/QR</div>
                    <div className="text-xs text-muted-foreground">Recipient claims via shared link or QR code</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {/* General validation error alert */}
        {errors.general && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          className="w-full"
          disabled={
            // Disable if there are validation errors
            Object.keys(errors).length > 0 &&
            // But only for fields that have been touched
            ((errors.recipient && touched.recipient) ||
             (errors.amount && touched.amount) ||
             !!errors.general)
          }
        >
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RecipientDetailsForm;
