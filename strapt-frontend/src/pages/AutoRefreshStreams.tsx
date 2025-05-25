import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, BarChart2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePaymentStream, StreamStatus } from '@/hooks/use-payment-stream';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { Loading } from '@/components/ui/loading';
import InfoTooltip from '@/components/InfoTooltip';
import EnhancedStreamCard from '@/components/streams/EnhancedStreamCard';
import type { UIStream } from '@/components/streams/EnhancedStreamCard';
import StreamForm from '@/components/streams/StreamForm';
import type { Milestone } from '@/components/MilestoneInput';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { Link } from 'react-router-dom';
import { useStreamsData } from '@/services/StreamsDataService';
import { useDataContext } from '@/providers/DataProvider';

const AutoRefreshStreams = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedStream, setSelectedStream] = useState<UIStream | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const { toast } = useToast();
  const { address, isConnected } = useXellarWallet();
  const { tokens, isLoading: isLoadingTokens } = useTokenBalances();
  const { refreshAllData } = useDataContext();

  // Initialize the payment stream hook
  const {
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    isStreamFullyClaimed
  } = usePaymentStream();

  // Get user streams using our new data service
  const { streams: contractStreams, isLoading: isLoadingStreams, refresh: refetchStreams } = useStreamsData();

  // Convert contract streams to UI streams
  const [activeStreams, setActiveStreams] = useState<UIStream[]>([]);
  const [completedStreams, setCompletedStreams] = useState<UIStream[]>([]);

  // Helper function to format address for display
  const formatAddress = useCallback((address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  // Calculate rate from stream data
  const calculateRateFromStream = useCallback((stream: {
    amount: string | number;
    endTime: number;
    startTime: number;
    tokenSymbol: string;
  }): string => {
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
  }, []);

  // Helper function to convert StreamStatus enum to string
  const getStatusString = useCallback((status: StreamStatus): 'active' | 'paused' | 'completed' | 'canceled' => {
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
  }, []);

  // Process streams when they change
  useEffect(() => {
    if (!contractStreams || !address) return;

    const active: UIStream[] = [];
    const completed: UIStream[] = [];

    for (const stream of contractStreams) {
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

      // Check if the stream is fully claimed or completed/canceled
      const isFullyClaimed = isStreamFullyClaimed(stream);

      // Add to appropriate array based on status or claim status
      if (stream.status === StreamStatus.Completed ||
          stream.status === StreamStatus.Canceled ||
          isFullyClaimed) {
        completed.push(uiStream);
      } else {
        active.push(uiStream);
      }
    }

    setActiveStreams(active);
    setCompletedStreams(completed);
  }, [contractStreams, address, calculateRateFromStream, isStreamFullyClaimed, getStatusString]);

  // Handle stream creation
  const handleCreateStream = async (data: {
    recipient: string;
    tokenType: 'USDC' | 'IDRX';
    amount: string;
    durationInSeconds: number;
    milestonePercentages: number[];
    milestoneDescriptions: string[];
  }) => {
    try {
      setIsCreatingStream(true);
      await createStream(
        data.recipient,
        data.tokenType,
        data.amount,
        data.durationInSeconds,
        data.milestonePercentages,
        data.milestoneDescriptions
      );

      toast({
        title: "Stream Created",
        description: `Successfully started streaming ${data.amount} ${data.tokenType} to ${data.recipient}`,
      });

      // Close the create dialog
      setShowCreate(false);

      // Refresh all data
      refreshAllData();
    } catch (error) {
      console.error('Error creating stream:', error);
      toast({
        title: "Error Creating Stream",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStream(false);
    }
  };

  // Handle stream status updates
  const handleStreamStatusUpdate = useCallback(async (streamId: string): Promise<void> => {
    // Refresh all data
    refreshAllData();
    return Promise.resolve();
  }, [refreshAllData]);

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
        <div className="flex w-full sm:w-auto gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetchStreams}
            disabled={isLoadingStreams}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingStreams ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="flex-1 sm:flex-none"
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            <span>Create Stream</span>
          </Button>
        </div>
      </div>

      <div className="mb-6 bg-secondary/30 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <BarChart2 className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-sm">About Payment Streams</h3>
            <p className="text-sm text-muted-foreground">
              Payment streams allow you to send tokens gradually over time. Recipients can claim tokens as they are streamed.
              You can pause, resume, or cancel streams at any time.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="w-full border-b">
          <TabsTrigger value="active" className="flex-1">Active Streams</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Completed Streams</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoadingStreams ? (
            <div className="flex justify-center items-center h-32">
              <Loading size="lg" />
            </div>
          ) : activeStreams.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <div className="flex justify-center mb-3">
                <BarChart2 className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-1">No active streams</h3>
              <p className="text-muted-foreground">
                Create a new payment stream to get started
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 mx-auto px-4"
                onClick={() => setShowCreate(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Stream
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeStreams.map((stream) => (
                <EnhancedStreamCard
                  key={stream.id}
                  stream={stream}
                  onPause={async () => {
                    await pauseStream(stream.id);
                    refreshAllData();
                    return Promise.resolve();
                  }}
                  onResume={async () => {
                    await resumeStream(stream.id);
                    refreshAllData();
                    return Promise.resolve();
                  }}
                  onCancel={async () => {
                    await cancelStream(stream.id);
                    refreshAllData();
                    return Promise.resolve();
                  }}
                  onReleaseMilestone={(stream, milestone) => {
                    setSelectedStream(stream);
                    setSelectedMilestone(milestone);
                    setShowReleaseDialog(true);
                  }}
                  onWithdraw={async () => {
                    await withdrawFromStream(stream.id);
                    refreshAllData();
                    return Promise.resolve();
                  }}
                  onStreamComplete={handleStreamStatusUpdate}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {isLoadingStreams ? (
            <div className="flex justify-center items-center h-32">
              <Loading size="lg" />
            </div>
          ) : completedStreams.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <div className="flex justify-center mb-3">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-lg font-medium mb-1">No completed streams</h3>
              <p className="text-muted-foreground">
                Completed and canceled streams will appear here
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completedStreams.map((stream) => (
                <EnhancedStreamCard
                  key={stream.id}
                  stream={stream}
                  onWithdraw={async () => {
                    await withdrawFromStream(stream.id);
                    refreshAllData();
                    return Promise.resolve();
                  }}
                  onStreamComplete={handleStreamStatusUpdate}
                />
              ))}
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
      {showReleaseDialog && selectedStream && selectedMilestone && (
        <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Release Milestone</DialogTitle>
              <DialogDescription>
                Are you sure you want to release this milestone? This will make {selectedMilestone.percentage}% of the total stream amount available for the recipient to claim.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <div className="bg-secondary/30 p-3 rounded-md">
                <p className="text-sm font-medium">Milestone Details</p>
                <p className="text-sm mt-1">{selectedMilestone.description}</p>
                <p className="text-sm mt-2 font-medium">Amount: {(selectedStream.total * selectedMilestone.percentage / 100).toFixed(2)} {selectedStream.token}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>Cancel</Button>
              <Button onClick={() => {
                releaseMilestone(selectedStream.id, Number.parseInt(selectedMilestone.id.split('-')[2], 10)).then(() => {
                  setShowReleaseDialog(false);
                  refreshAllData();
                });
              }}>Release Milestone</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AutoRefreshStreams;
