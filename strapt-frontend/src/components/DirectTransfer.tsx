import { useState } from 'react';
import { useProtectedTransferV2 } from '@/hooks/use-protected-transfer-v2';
import { useTransactionProgress } from '@/hooks/useTransactionProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionProgress } from './TransactionProgress';
import { TokenSelector } from './TokenSelector';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
// @ts-ignore
import Confetti from 'react-confetti';

export function DirectTransfer() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'USDC' | 'IDRX'>('USDC');
  const { createDirectTransfer } = useProtectedTransferV2();
  const { progress, startTransaction, setError, completeTransaction } = useTransactionProgress();
  const [success, setSuccess] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    transferId: string;
    recipient: string;
    amount: string;
    token: string;
    originalAmount: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTransfer = async () => {
    if (!recipient || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      startTransaction();
      const result = await createDirectTransfer(
        recipient,
        selectedToken,
        amount,
        Math.floor(Date.now() / 1000) + 24 * 3600, // 24 hours expiry
        false
      );

      if (result) {
        completeTransaction();
        setSuccess(true);
        setTransferResult({
          transferId: result.transferId || 'Not available',
          recipient,
          amount,
          token: selectedToken,
          originalAmount: amount, // If you have fee logic, adjust here
        });
        toast.success('Transfer created successfully');
        setRecipient('');
        setAmount('');
      }
    } catch (error) {
      setError(error.message || 'Failed to create transfer');
    }
  };

  const handleCopy = () => {
    if (transferResult?.transferId) {
      navigator.clipboard.writeText(transferResult.transferId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (success && transferResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
        <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={200} recycle={false} />
        <Card className="w-full max-w-md mx-auto shadow-lg border border-purple-700 bg-zinc-900">
          <CardHeader className="flex flex-col items-center">
            <div className="rounded-full bg-purple-700 p-3 mb-2">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#a78bfa"/><path d="M8 12.5l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <CardTitle className="text-2xl font-bold text-center text-purple-200">Transfer Created!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-base text-white">
              Your direct transfer of <span className="font-bold">{transferResult.amount} {transferResult.token}</span> to <span className="font-mono">{transferResult.recipient.slice(0,6)}...{transferResult.recipient.slice(-4)}</span> has been sent.
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm text-gray-300 text-center">
              <div>No fees are charged for transfers.</div>
              <div className="mt-1">Amount: <span className="font-semibold">{transferResult.amount} {transferResult.token}</span></div>
              <div>Recipient will receive: <span className="font-semibold">{transferResult.amount} {transferResult.token}</span></div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm text-gray-300">
              <div className="font-semibold mb-1">Share these details with the recipient:</div>
              <div className="mb-2">The recipient will need the Transfer ID to claim the funds.</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-zinc-900 px-2 py-1 rounded select-all flex-1">{transferResult.transferId}</span>
                <Button size="icon" variant="ghost" onClick={handleCopy} className="ml-1">
                  <Copy size={16} />
                </Button>
                {copied && <span className="text-green-400 text-xs ml-2">Copied!</span>}
              </div>
            </div>
            <div className="text-xs text-center text-gray-400 pt-2 border-t border-zinc-800">
              <div className="mb-1 font-semibold">Claim Instructions:</div>
              Recipient should visit:<br />
              <span className="font-mono text-purple-300">http://localhost:8080/app/claims</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Direct Transfer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <TokenSelector
            value={selectedToken}
            onChange={setSelectedToken}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleTransfer}
          disabled={progress.status !== 'idle'}
        >
          {progress.status === 'idle' ? 'Transfer' : 'Processing...'}
        </Button>

        <TransactionProgress />
      </CardContent>
    </Card>
  );
}
