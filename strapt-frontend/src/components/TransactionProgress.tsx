import { Progress } from '@/components/ui/progress';
import { useTransactionProgress, TransactionStatus } from '@/hooks/useTransactionProgress';
import { cn } from '@/lib/utils';

const statusMessages: Record<TransactionStatus, string> = {
  idle: 'Ready',
  preparing: 'Preparing transaction...',
  simulating: 'Simulating transaction...',
  confirming: 'Confirming transaction...',
  confirmed: 'Transaction confirmed!',
  failed: 'Transaction failed'
};

const statusColors: Record<TransactionStatus, string> = {
  idle: 'bg-gray-200',
  preparing: 'bg-blue-500',
  simulating: 'bg-blue-500',
  confirming: 'bg-blue-500',
  confirmed: 'bg-green-500',
  failed: 'bg-red-500'
};

export function TransactionProgress() {
  const { progress } = useTransactionProgress();

  if (progress.status === 'idle') {
    return null;
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {statusMessages[progress.status]}
        </span>
        <span className="text-sm text-muted-foreground">
          {progress.progress}%
        </span>
      </div>
      <Progress 
        value={progress.progress} 
        className={cn(
          "h-2",
          statusColors[progress.status]
        )}
      />
      {progress.error && (
        <p className="text-sm text-red-500 mt-2">
          {progress.error}
        </p>
      )}
    </div>
  );
} 
