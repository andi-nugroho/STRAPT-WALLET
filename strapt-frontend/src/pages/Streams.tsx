import { useState, useCallback, useEffect } from 'react';
import { Play, Pause, StopCircle, PlusCircle, BarChart2, ArrowRight, Milestone, CircleDollarSign, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MilestoneInput from '@/components/MilestoneInput';
import type { Milestone as MilestoneType } from '@/components/MilestoneInput';
import DurationSelect from '@/components/DurationSelect';
import type { DurationUnit } from '@/components/DurationSelect';
import TokenSelect from '@/components/TokenSelect';
import type { TokenOption } from '@/components/TokenSelect';
import { usePaymentStream } from '@/hooks/use-payment-stream';
import type { Stream as ContractStream, TokenType } from '@/hooks/use-payment-stream';
import { StreamStatus } from '@/hooks/use-payment-stream';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { Loading } from '@/components/ui/loading';
import LiveStreamCounter from '@/components/LiveStreamCounter';
import InfoTooltip from '@/components/InfoTooltip';
import { useTokenBalances } from '@/hooks/use-token-balances';
import StreamForm from '@/components/StreamForm';

// UI Stream interface that extends the contract Stream type
interface UIStream {
  id: string;
  recipient: string;
  sender: string;
  total: number;
  streamed: number;
  rate: string; // e.g. "0.1 USDC/min"
  status: 'active' | 'paused' | 'completed' | 'canceled';
  milestones?: MilestoneType[];
  token: string;
  startTime: number; // Unix timestamp in seconds
  endTime: number; // Unix timestamp in seconds
  isRecipient: boolean; // Whether the current user is the recipient
  isSender: boolean; // Whether the current user is the sender
}

const Streams = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedStream, setSelectedStream] = useState<UIStream | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneType | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(60);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('minutes');
  const [milestones, setMilestones] = useState<MilestoneType[]>([]);
  const { tokens, isLoading: isLoadingTokens } = useTokenBalances();
  const [selectedToken, setSelectedToken] = useState<TokenOption>(tokens[0]);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const { toast } = useToast();
  const { address, isConnected } = useXellarWallet();

  // Initialize the payment stream hook
  const {
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    useUserStreams
  } = usePaymentStream();

  // Get user streams
  const { streams: contractStreams, isLoading: isLoadingStreams, refetch: refetchStreams, updateStreamStatus } = useUserStreams(address);

  // Convert contract streams to UI streams
  const [activeStreams, setActiveStreams] = useState<UIStream[]>([]);
  const [completedStreams, setCompletedStreams] = useState<UIStream[]>([]);

  // Update selected token when tokens array changes
  useEffect(() => {
    if (tokens.length > 0) {
      // Find the token with the same symbol as the currently selected one
      const currentSymbol = selectedToken?.symbol;
      const newSelected = tokens.find(t => t.symbol === currentSymbol) || tokens[0];
      setSelectedToken(newSelected);
    }
  }, [tokens, selectedToken?.symbol]);

  // Process streams when they change
  useEffect(() => {
    console.log('Contract streams changed:', contractStreams);
    if (!contractStreams) return;

    const active: UIStream[] = [];
    const completed: UIStream[] = [];

    for (const stream of contractStreams) {
      console.log('Processing stream:', stream);
      // Convert contract stream to UI stream
      const uiStream: UIStream = {
        id: stream.id,
        recipient: stream.recipient,
        sender: stream.sender,
        total: Number(stream.amount),
        streamed: Number(stream.streamed),
        rate: calculateRateFromStream(stream),
        status: getStatusString(stream.status),
        token: stream.tokenSymbol,
        startTime: stream.startTime,
        endTime: stream.endTime,
        isRecipient: address?.toLowerCase() === stream.recipient.toLowerCase(),
        isSender: address?.toLowerCase() === stream.sender.toLowerCase(),
        milestones: stream.milestones.map((m, index) => ({
          id: `ms-${stream.id}-${index}`,
          percentage: m.percentage,
          description: m.description,
          released: m.released
        }))
      };

      // Add to appropriate array based on status
      if (stream.status === StreamStatus.Completed || stream.status === StreamStatus.Canceled) {
        completed.push(uiStream);
      } else {
        active.push(uiStream);
      }
    }

    console.log('Active streams:', active);
    console.log('Completed streams:', completed);

    setActiveStreams(active);
    setCompletedStreams(completed);
  }, [contractStreams, address]);

  // Helper function to convert StreamStatus to string
  const getStatusString = (status: StreamStatus): 'active' | 'paused' | 'completed' | 'canceled' => {
    switch (status) {
      case StreamStatus.Active:
        return 'active';
      case StreamStatus.Paused:
        return 'paused';
      case StreamStatus.Completed:
        return 'completed';
      case StreamStatus.Canceled:
        return 'canceled';
      default:
        return 'active';
    }
  };

  // Helper function to format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate rate from stream data
  const calculateRateFromStream = (stream: ContractStream): string => {
    const amount = Number(stream.amount);
    const duration = stream.endTime - stream.startTime;

    if (duration <= 0) return '0';

    const ratePerSecond = amount / duration;

    if (ratePerSecond >= 1) {
      return `${ratePerSecond.toFixed(2)} ${stream.tokenSymbol}/second`;
    }
    if (ratePerSecond * 60 >= 1) {
      return `${(ratePerSecond * 60).toFixed(2)} ${stream.tokenSymbol}/minute`;
    }
    if (ratePerSecond * 3600 >= 1) {
      return `${(ratePerSecond * 3600).toFixed(2)} ${stream.tokenSymbol}/hour`;
    }
    return `${(ratePerSecond * 86400).toFixed(4)} ${stream.tokenSymbol}/day`;
  };

  const handleDurationChange = (value: number, unit: DurationUnit) => {
    setDuration(value);
    setDurationUnit(unit);
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a stream",
        variant: "destructive"
      });
      return;
    }

    if (!recipient || !amount || !duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validate amount
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    // Check if amount is greater than balance
    if (selectedToken.balance && Number(amount) > selectedToken.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${selectedToken.balance} ${selectedToken.symbol} available`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingStream(true);

      // Calculate duration in seconds
      let durationInSeconds = duration;
      if (durationUnit === 'minutes') durationInSeconds *= 60;
      if (durationUnit === 'hours') durationInSeconds *= 3600;
      if (durationUnit === 'days') durationInSeconds *= 86400;

      // Extract milestone data
      const milestonePercentages = milestones.map(m => m.percentage);
      const milestoneDescriptions = milestones.map(m => m.description);

      // Create the stream
      const tokenType = selectedToken.symbol as TokenType;
      await createStream(
        recipient,
        tokenType,
        amount,
        durationInSeconds,
        milestonePercentages,
        milestoneDescriptions
      );

      toast({
        title: "Stream Created",
        description: `Successfully started streaming ${amount} ${selectedToken.symbol} to ${recipient}`,
      });

      // Reset form and refresh streams
      setShowCreate(false);
      setRecipient('');
      setAmount('');
      setDuration(60);
      setDurationUnit('minutes');
      setMilestones([]);

      // Refresh streams list
      refetchStreams();
    } catch (error) {
      console.error('Error creating stream:', error);
      toast({
        title: "Error Creating Stream",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCreatingStream(false);
    }
  };

  const getStatusIcon = (status: 'active' | 'paused' | 'completed' | 'canceled') => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-white" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-amber-500" />;
      case 'completed':
        return <StopCircle className="h-4 w-4 text-white" />;
      case 'canceled':
        return <StopCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Play className="h-4 w-4 text-white" />;
    }
  };

  const getProgressColor = (status: 'active' | 'paused' | 'completed' | 'canceled') => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-amber-500';
      case 'completed':
        return 'bg-blue-500';
      case 'canceled':
        return 'bg-red-500';
      default:
        return 'bg-green-500';
    }
  };

  // This function is now inlined in the onClick handler

  const handleReleaseFunds = async () => {
    if (!selectedStream || !selectedMilestone) return;

    try {
      // Extract milestone index from the ID
      const idParts = selectedMilestone.id.split('-');
      const milestoneIndex = Number.parseInt(idParts[idParts.length - 1], 10);

      // Release the milestone
      await releaseMilestone(selectedStream.id, milestoneIndex);

      // Update the milestone in the local state
      const updatedMilestones = selectedStream.milestones?.map((m, index) => {
        if (index === milestoneIndex) {
          return { ...m, released: true };
        }
        return m;
      });

      // Update the UI immediately
      setActiveStreams(prev =>
        prev.map(stream =>
          stream.id === selectedStream.id
            ? { ...stream, milestones: updatedMilestones }
            : stream
        )
      );

      const releaseAmount = (selectedMilestone.percentage / 100) * selectedStream.total;

      toast({
        title: "Funds Released",
        description: `Successfully released ${releaseAmount} ${selectedStream.token} to ${formatAddress(selectedStream.recipient)} for milestone: ${selectedMilestone.description}`,
      });

      // Refresh streams to ensure data consistency
      refetchStreams();
    } catch (error) {
      console.error('Error releasing milestone:', error);
      toast({
        title: "Error Releasing Funds",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setShowReleaseDialog(false);
    }
  };

  const getMilestoneMarkers = (stream: UIStream) => {
    if (!stream.milestones || stream.milestones.length === 0) return null;

    return (
      <div className="relative h-1 mt-1">
        {stream.milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="absolute top-0 w-1 h-3 bg-primary rounded"
            style={{ left: `${milestone.percentage}%`, transform: 'translateX(-50%)' }}
            title={`${milestone.description} (${milestone.percentage}%)`}
          />
        ))}
      </div>
    );
  };

  const calculateStreamRate = () => {
    if (!amount || !duration) return '0';

    const amountNum = Number.parseFloat(amount);

    let seconds = duration;
    if (durationUnit === 'minutes') seconds *= 60;
    if (durationUnit === 'hours') seconds *= 3600;
    if (durationUnit === 'days') seconds *= 86400;

    const ratePerSecond = amountNum / seconds;

    if (ratePerSecond >= 1) {
      return `${ratePerSecond.toFixed(2)} ${selectedToken.symbol}/second`;
    }

    if (ratePerSecond * 60 >= 1) {
      return `${(ratePerSecond * 60).toFixed(2)} ${selectedToken.symbol}/minute`;
    }

    if (ratePerSecond * 3600 >= 1) {
      return `${(ratePerSecond * 3600).toFixed(2)} ${selectedToken.symbol}/hour`;
    }

    return `${(ratePerSecond * 86400).toFixed(4)} ${selectedToken.symbol}/day`;
  };

  const getDurationInMinutes = () => {
    switch (durationUnit) {
      case 'seconds': return duration / 60;
      case 'minutes': return duration;
      case 'hours': return duration * 60;
      case 'days': return duration * 24 * 60;
      default: return duration;
    }
  };

  const renderMilestoneReleaseButtons = (stream: UIStream) => {
    if (!stream.milestones || stream.milestones.length === 0) return null;

    const streamPercentage = (stream.streamed / stream.total) * 100;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Milestone Releases:</div>
        <div className="grid grid-cols-2 gap-2">
          {stream.milestones.map((milestone) => {
            const isReachable = streamPercentage >= milestone.percentage;
            return (
              <Button
                key={milestone.id}
                variant="outline"
                size="sm"
                className="h-auto py-1 text-xs"
                disabled={!isReachable || milestone.released}
                onClick={() => {
                  setSelectedStream(stream);
                  setSelectedMilestone(milestone);
                  setShowReleaseDialog(true);
                }}
              >
                <CircleDollarSign className="h-3 w-3 mr-1" />
                {milestone.released ? (
                  <>Released {milestone.percentage}%</>
                ) : (
                  <>Release {milestone.percentage}%</>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Payment Streams</h2>
          <InfoTooltip
            content={
              <div>
                <p className="font-medium mb-1">About Payment Streams</p>
                <p className="mb-1">Payment streams allow you to send tokens gradually over time to recipients.</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>Tokens are streamed continuously in real-time</li>
                  <li>Recipients can claim tokens at any time</li>
                  <li>Senders can pause, resume, or cancel streams</li>
                  <li>Add milestones to release funds at specific points</li>
                </ul>
              </div>
            }
          />
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="w-full sm:w-auto flex items-center justify-center gap-1"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Stream</span>
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          {isLoadingStreams ? (
            <div className="flex justify-center items-center py-12">
              <Loading size="lg" text="Loading streams..." />
            </div>
          ) : activeStreams.length > 0 ? (
            <div className="space-y-4">
              {activeStreams.map((stream) => (
                <Card key={stream.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle className="text-base">{formatAddress(stream.recipient)}</CardTitle>
                      <div className="flex items-center gap-1 text-sm relative group">
                        {getStatusIcon(stream.status)}
                        <span className="capitalize">{stream.status}</span>
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                          {stream.status === 'active' && "Tokens are actively streaming to the recipient."}
                          {stream.status === 'paused' && "Stream is temporarily paused. No tokens are being streamed."}
                          {stream.status === 'completed' && "Stream has completed. All tokens have been streamed."}
                          {stream.status === 'canceled' && "Stream was canceled. Remaining tokens returned to sender."}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-3">
                      <div className="relative group">
                        <LiveStreamCounter
                          startTime={stream.startTime}
                          endTime={stream.endTime}
                          amount={stream.total.toString()}
                          streamed={stream.streamed.toString()}
                          status={StreamStatus[stream.status as keyof typeof StreamStatus]}
                          token={stream.token}
                          streamId={stream.id}
                          onStreamComplete={(streamId) => {
                            console.log('Stream completed automatically:', streamId);
                            // Update local state immediately
                            updateStreamStatus(streamId, StreamStatus.Completed);
                            // Move the stream from active to completed
                            const completedStream = activeStreams.find(s => s.id === streamId);
                            if (completedStream) {
                              setActiveStreams(prev => prev.filter(s => s.id !== streamId));
                              setCompletedStreams(prev => [...prev, {...completedStream, status: 'completed'}]);
                            }
                          }}
                        />
                        <div className="absolute top-0 right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <InfoTooltip
                            content={
                              <div>
                                <p className="font-medium mb-1">Stream Progress</p>
                                <p className="mb-1">This shows how many tokens have been streamed so far.</p>
                                <ul className="list-disc pl-4 text-xs space-y-1">
                                  <li>For active streams, this updates every 5 seconds</li>
                                  <li>When a stream reaches 100%, it automatically completes</li>
                                  <li>Recipients can claim tokens at any time</li>
                                  <li>After claiming, the stream starts from 0 again</li>
                                </ul>
                              </div>
                            }
                            side="left"
                          />
                        </div>
                        <Progress
                          value={(stream.streamed / stream.total) * 100}
                          className={getProgressColor(stream.status)}
                        />
                        {stream.milestones && stream.milestones.length > 0 && getMilestoneMarkers(stream)}
                      </div>
                      <div className="flex justify-between text-sm relative group">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Rate
                          <InfoTooltip
                            content="The rate at which tokens are streamed to the recipient over time."
                            iconSize={12}
                          />
                        </span>
                        <span>{stream.rate}</span>
                      </div>

                      {stream.milestones && stream.milestones.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground relative group">
                          <Milestone className="h-3 w-3" />
                          <span>{stream.milestones.length} milestone{stream.milestones.length !== 1 ? 's' : ''}</span>
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                            <p className="font-medium mb-1">Milestones</p>
                            <p className="mb-2">This stream has {stream.milestones.length} milestone{stream.milestones.length !== 1 ? 's' : ''} that can be released by the sender:</p>
                            <ul className="space-y-1">
                              {stream.milestones.map((milestone) => (
                                <li key={milestone.id} className="flex justify-between">
                                  <span>{milestone.description}</span>
                                  <span className="font-medium">{milestone.percentage}%</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {stream.milestones && stream.milestones.length > 0 && renderMilestoneReleaseButtons(stream)}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    {stream.isSender ? (
                      // Sender controls
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {stream.status === 'active' ? (
                          <div className="relative group">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await pauseStream(stream.id);
                                  // Update local state immediately
                                  updateStreamStatus(stream.id, StreamStatus.Paused);
                                  toast({
                                    title: "Stream Paused",
                                    description: `Successfully paused stream to ${formatAddress(stream.recipient)}`
                                  });
                                  // Still refetch to ensure data consistency
                                  refetchStreams();
                                } catch (error) {
                                  console.error('Error pausing stream:', error);
                                  toast({
                                    title: "Error Pausing Stream",
                                    description: error instanceof Error ? error.message : "An unknown error occurred",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <Pause className="h-4 w-4 mr-1" /> Pause
                            </Button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                              Temporarily stop the stream. The recipient won't receive more tokens until you resume.
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await resumeStream(stream.id);
                                  // Update local state immediately
                                  updateStreamStatus(stream.id, StreamStatus.Active);
                                  toast({
                                    title: "Stream Resumed",
                                    description: `Successfully resumed stream to ${formatAddress(stream.recipient)}`
                                  });
                                  // Still refetch to ensure data consistency
                                  refetchStreams();
                                } catch (error) {
                                  console.error('Error resuming stream:', error);
                                  toast({
                                    title: "Error Resuming Stream",
                                    description: error instanceof Error ? error.message : "An unknown error occurred",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <Play className="h-4 w-4 mr-1" /> Resume
                            </Button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                              Continue a paused stream. The recipient will start receiving tokens again.
                            </div>
                          </div>
                        )}
                        <div className="relative group">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await cancelStream(stream.id);
                                // Update local state immediately
                                updateStreamStatus(stream.id, StreamStatus.Canceled);
                                toast({
                                  title: "Stream Canceled",
                                  description: `Successfully canceled stream to ${formatAddress(stream.recipient)}`
                                });
                                // Still refetch to ensure data consistency
                                refetchStreams();
                              } catch (error) {
                                console.error('Error canceling stream:', error);
                                toast({
                                  title: "Error Canceling Stream",
                                  description: error instanceof Error ? error.message : "An unknown error occurred",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <StopCircle className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                            Permanently stop the stream. Any unclaimed tokens will be returned to you.
                          </div>
                        </div>
                      </div>
                    ) : stream.isRecipient ? (
                      // Recipient controls
                      <div className="w-full">
                        <div className="relative group">
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={async () => {
                              try {
                                await withdrawFromStream(stream.id);

                                // Update the local state to reflect that tokens have been claimed
                                // When a recipient claims tokens, the stream should start from 0 again

                                // Update the stream in the local state to set streamed amount to 0
                                setActiveStreams(prev =>
                                  prev.map(s =>
                                    s.id === stream.id
                                      ? { ...s, streamed: 0 }
                                      : s
                                  )
                                );

                                toast({
                                  title: "Tokens Claimed",
                                  description: "Successfully claimed tokens from the stream"
                                });

                                // Refetch to get updated streamed amount from blockchain
                                refetchStreams();
                              } catch (error) {
                                console.error('Error claiming tokens:', error);
                                toast({
                                  title: "Error Claiming Tokens",
                                  description: error instanceof Error ? error.message : "An unknown error occurred",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <CircleDollarSign className="h-4 w-4 mr-1" /> Claim Tokens
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                            Withdraw tokens that have been streamed to you so far. After claiming, the stream will start from 0 again.
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Viewer (not sender or recipient)
                      <div className="text-center w-full text-sm text-muted-foreground">
                        Stream from {formatAddress(stream.sender)} to {formatAddress(stream.recipient)}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8">
              <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">No Active Streams</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start streaming payments to someone
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {isLoadingStreams ? (
            <div className="flex justify-center items-center py-12">
              <Loading size="lg" text="Loading streams..." />
            </div>
          ) : completedStreams.length > 0 ? (
            <div className="space-y-4">
              {completedStreams.map((stream) => (
                <Card key={stream.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle className="text-base">{formatAddress(stream.recipient)}</CardTitle>
                      <div className="flex items-center gap-1 text-sm relative group">
                        {getStatusIcon(stream.status)}
                        <span className="capitalize">{stream.status}</span>
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                          {stream.status === 'active' && "Tokens are actively streaming to the recipient."}
                          {stream.status === 'paused' && "Stream is temporarily paused. No tokens are being streamed."}
                          {stream.status === 'completed' && "Stream has completed. All tokens have been streamed."}
                          {stream.status === 'canceled' && "Stream was canceled. Remaining tokens returned to sender."}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-3">
                      <div className="relative group">
                        <LiveStreamCounter
                          startTime={stream.startTime}
                          endTime={stream.endTime}
                          amount={stream.total.toString()}
                          streamed={stream.streamed.toString()}
                          status={StreamStatus[stream.status as keyof typeof StreamStatus]}
                          token={stream.token}
                          streamId={stream.id}
                        />
                        <div className="absolute top-0 right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <InfoTooltip
                            content={
                              <div>
                                <p className="font-medium mb-1">Stream Progress</p>
                                <p className="mb-1">This shows how many tokens have been streamed in total.</p>
                                <ul className="list-disc pl-4 text-xs space-y-1">
                                  <li>Completed streams show 100% of tokens streamed</li>
                                  <li>Canceled streams show the amount streamed before cancellation</li>
                                </ul>
                              </div>
                            }
                            side="left"
                          />
                        </div>
                        <Progress
                          value={(stream.streamed / stream.total) * 100}
                          className="bg-blue-500"
                        />
                      </div>
                      <div className="flex justify-between text-sm relative group">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Rate
                          <InfoTooltip
                            content="The rate at which tokens were streamed to the recipient over time."
                            iconSize={12}
                          />
                        </span>
                        <span>{stream.rate}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center p-8">
              <CheckCircle className="h-12 w-12 text-white mx-auto mb-3" />
              <h3 className="font-medium mb-1">No Completed Streams</h3>
              <p className="text-sm text-muted-foreground">
                Your completed streams will appear here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Stream Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[95%] w-[95%] p-3 mx-auto rounded-xl md:max-w-lg md:p-4">
          <StreamForm
            onCancel={() => setShowCreate(false)}
            onSubmit={handleCreateStream}
            isCreatingStream={isCreatingStream}
            tokens={tokens}
            isLoadingTokens={isLoadingTokens}
          />
        </DialogContent>
      </Dialog>

      {/* Release Milestone Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Milestone Funds</DialogTitle>
            <DialogDescription>
              Are you sure you want to release funds for this milestone?
            </DialogDescription>
          </DialogHeader>

          {selectedStream && selectedMilestone && (
            <div className="py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm text-muted-foreground">Recipient:</div>
                  <div className="text-sm font-medium">{formatAddress(selectedStream.recipient)}</div>

                  <div className="text-sm text-muted-foreground">Milestone:</div>
                  <div className="text-sm font-medium">{selectedMilestone.description}</div>

                  <div className="text-sm text-muted-foreground">Percentage:</div>
                  <div className="text-sm font-medium">{selectedMilestone.percentage}%</div>

                  <div className="text-sm text-muted-foreground">Amount:</div>
                  <div className="text-sm font-medium">
                    {((selectedMilestone.percentage / 100) * selectedStream.total).toFixed(2)} {selectedStream.token}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>Cancel</Button>
            <Button onClick={handleReleaseFunds}>Release Funds</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Streams;
