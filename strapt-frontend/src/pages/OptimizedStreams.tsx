import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, BarChart2, Info, ArrowLeft, CheckCircle } from 'lucide-react';
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
import { usePaymentStream } from '@/hooks/use-payment-stream';
import { StreamStatus } from '@/hooks/use-payment-stream';
import { useXellarWallet } from '@/hooks/use-xellar-wallet';
import { Loading } from '@/components/ui/loading';
import InfoTooltip from '@/components/InfoTooltip';
import EnhancedStreamCard from '@/components/streams/EnhancedStreamCard';
import type { UIStream } from '@/components/streams/EnhancedStreamCard';
import StreamForm from '@/components/streams/StreamForm';
import type { Milestone } from '@/components/MilestoneInput';
import type { TokenOption } from '@/components/TokenSelect';
import { useTokenBalances } from '@/hooks/use-token-balances';
import { Link } from 'react-router-dom';

const OptimizedStreams = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedStream, setSelectedStream] = useState<UIStream | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const { toast } = useToast();
  const { address, isConnected } = useXellarWallet();
  const { tokens, isLoading: isLoadingTokens } = useTokenBalances();

  // Initialize the payment stream hook
  const {
    createStream,
    pauseStream,
    resumeStream,
    cancelStream,
    releaseMilestone,
    withdrawFromStream,
    useUserStreams,
    isStreamFullyClaimed
  } = usePaymentStream();

  // Get user streams
  const { streams: contractStreams, isLoading: isLoadingStreams, refetch: refetchStreams, updateStreamStatus } = useUserStreams(address);

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

  // Process streams when they change
  useEffect(() => {
    if (!contractStreams) return;

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
  }, [contractStreams, address, calculateRateFromStream, isStreamFullyClaimed]);

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

      setShowCreate(false);
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link to="/app">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Payment Streams</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Stream
        </Button>
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
                className="mt-4"
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
                  onPause={() => pauseStream(stream.id)}
                  onResume={() => resumeStream(stream.id)}
                  onCancel={() => cancelStream(stream.id)}
                  onReleaseMilestone={(stream, milestone) => {
                    setSelectedStream(stream);
                    setSelectedMilestone(milestone);
                    setShowReleaseDialog(true);
                  }}
                  onWithdraw={() => withdrawFromStream(stream.id)}
                  onStreamComplete={updateStreamStatus}
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
                <CheckCircle className="h-10 w-10 text-muted-foreground/50" />
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
                  onWithdraw={() => withdrawFromStream(stream.id)}
                  onStreamComplete={updateStreamStatus}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Stream Dialog */}
      {showCreate && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl">
            <StreamForm
              onCancel={() => setShowCreate(false)}
              onSubmit={handleCreateStream}
              isCreatingStream={isCreatingStream}
              tokens={tokens}
              isLoadingTokens={isLoadingTokens}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Release Milestone Dialog */}
      {showReleaseDialog && selectedStream && selectedMilestone && (
        <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Release Milestone</DialogTitle>
              <DialogDescription>
                Are you sure you want to release this milestone? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Milestone: {selectedMilestone.description}
              </p>
              <p className="text-sm text-muted-foreground">
                Percentage: {selectedMilestone.percentage}%
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowReleaseDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await releaseMilestone(selectedStream.id, selectedMilestone.id);
                    toast({
                      title: "Milestone Released",
                      description: "The milestone has been successfully released",
                    });
                    setShowReleaseDialog(false);
                    refetchStreams();
                  } catch (error) {
                    console.error('Error releasing milestone:', error);
                    toast({
                      title: "Error Releasing Milestone",
                      description: error instanceof Error ? error.message : "An unknown error occurred",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Release
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default OptimizedStreams;
