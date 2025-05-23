import { useState, useEffect } from 'react';
import { StreamStatus } from '@/hooks/use-payment-stream';

interface LiveStreamCounterProps {
  startTime: number;
  endTime: number;
  amount: string;
  streamed: string;
  status: StreamStatus;
  token: string;
  streamId?: string;
  onStreamComplete?: (streamId: string) => void;
}

/**
 * Component to display a live counter of streamed tokens
 * Updates every second for active streams
 */
const LiveStreamCounter = ({
  startTime,
  endTime,
  amount,
  streamed,
  status,
  token,
  streamId,
  onStreamComplete
}: LiveStreamCounterProps) => {
  const [currentStreamed, setCurrentStreamed] = useState(streamed);
  const [percentage, setPercentage] = useState(0);

  // Reset the UI when streamed amount changes (e.g., after claiming)
  // or when status changes
  useEffect(() => {
    // For completed or canceled streams, just show the final amount immediately
    if (status === StreamStatus.Completed || status === StreamStatus.Canceled) {
      // If streamed is 0 (fully claimed), show 0
      if (Number(streamed) <= 0) {
        setCurrentStreamed('0');
        setPercentage(0);
      } else {
        // Otherwise show the full amount
        setCurrentStreamed(amount);
        setPercentage(100);
      }
      return;
    }

    // For paused streams, show the current streamed amount
    if (status === StreamStatus.Paused) {
      setCurrentStreamed(streamed);
      setPercentage(Number(streamed) / Number(amount) * 100);
      return;
    }

    // For active streams, update with the current streamed amount
    // but will be updated by the interval
    setCurrentStreamed(streamed);
    setPercentage(Number(streamed) / Number(amount) * 100);
  }, [streamed, amount, status]);

  useEffect(() => {
    // Only proceed for active streams
    if (status !== StreamStatus.Active) {
      return;
    }

    // For active streams, calculate and update in real-time
    const calculateStreamed = () => {
      const now = Math.floor(Date.now() / 1000);
      const totalDuration = endTime - startTime;
      const totalAmount = Number(amount);

      // Check if the stream has completed based on time
      const isTimeComplete = now >= endTime;

      // If the stream is complete by time but still active, update its status
      if (isTimeComplete && streamId && onStreamComplete) {
        console.log('Stream completed by time:', streamId);
        onStreamComplete(streamId);

        // Show the full amount
        setCurrentStreamed(totalAmount.toFixed(6));
        setPercentage(100);
        return;
      }

      // Calculate streamed amount based on elapsed time
      const elapsedDuration = Math.min(now - startTime, totalDuration);
      const streamedSoFar = Math.min(
        totalAmount * (elapsedDuration / totalDuration),
        totalAmount
      );

      setCurrentStreamed(streamedSoFar.toFixed(6));
      const newPercentage = (streamedSoFar / totalAmount) * 100;
      setPercentage(newPercentage);

      // If we've reached 100% but the stream is still active, mark it as complete
      if (newPercentage >= 99.9 && streamId && onStreamComplete) {
        console.log('Stream completed by amount:', streamId);
        onStreamComplete(streamId);
      }
    };

    // Calculate initial value
    calculateStreamed();

    // Set up interval for active streams
    const interval = setInterval(calculateStreamed, 5000);
    return () => clearInterval(interval);
  }, [startTime, endTime, amount, status, streamId, onStreamComplete]);

  // Format numbers to remove trailing zeros
  const formatNumber = (num: number): string => {
    // Convert to number first to handle string inputs
    const value = Number(num);
    // Use toFixed(4) to limit decimal places, then parse and stringify to remove trailing zeros
    return Number.parseFloat(value.toFixed(4)).toString();
  };

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground flex items-center">
          Streamed
          {status === StreamStatus.Active && (
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </span>
        <div className="font-medium">
          <span className={status === StreamStatus.Active ? "text-primary" : ""}>
            {formatNumber(Number(currentStreamed))}
          </span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span>{formatNumber(Number(amount))} {token}</span>
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span className={percentage >= 99.9 ? "text-green-600 dark:text-green-400 font-medium" : ""}>
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default LiveStreamCounter;
