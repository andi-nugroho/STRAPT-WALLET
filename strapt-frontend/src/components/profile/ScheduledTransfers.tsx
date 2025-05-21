
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CalendarIcon, CalendarClock, Clock, ChevronRight, Plus, Edit2, Trash, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useScheduledTransfers } from '@/hooks/use-scheduled-transfers';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const ScheduledTransfers = () => {
  const {
    scheduledTransfers,
    isLoading,
    addScheduledTransfer,
    cancelScheduledTransfer,
    removeScheduledTransfer
  } = useScheduledTransfers();

  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState('once');
  const [selectedToken, setSelectedToken] = useState('IDRX');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form refs
  const recipientRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const handleCreateScheduled = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    // Get values from refs
    const recipient = recipientRef.current?.value || '';
    const amount = amountRef.current?.value || '';

    // Validate
    if (!recipient || !amount || !date) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // Determine if recurring
    const recurring = selectedFrequency !== 'once';

    // Map frequency
    let frequency: 'daily' | 'weekly' | 'monthly' | undefined;
    if (recurring) {
      switch (selectedFrequency) {
        case 'daily': frequency = 'daily'; break;
        case 'weekly': frequency = 'weekly'; break;
        case 'monthly': frequency = 'monthly'; break;
        default: frequency = undefined;
      }
    }

    // Add the scheduled transfer
    addScheduledTransfer({
      recipient,
      recipientName: recipient.includes('0x') ? undefined : recipient,
      amount,
      token: selectedToken,
      scheduledDate: date.toISOString(),
      recurring,
      frequency,
    });

    // Reset form
    if (recipientRef.current) recipientRef.current.value = '';
    if (amountRef.current) amountRef.current.value = '';
    setDate(new Date());
    setSelectedFrequency('once');
    setSelectedToken('IDRX');

    toast({
      title: "Transfer scheduled",
      description: "Your transfer has been scheduled successfully",
      duration: 3000,
    });

    setIsSubmitting(false);
    setShowNewTransfer(false);
  };

  const handleCancelTransfer = (id: string) => {
    cancelScheduledTransfer(id);
    toast({
      title: "Transfer cancelled",
      description: "The scheduled transfer has been cancelled",
      duration: 3000,
    });
  };

  const handleDeleteTransfer = (id: string) => {
    removeScheduledTransfer(id);
    toast({
      title: "Transfer removed",
      description: "The scheduled transfer has been removed",
      duration: 3000,
    });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} weeks`;
    return `In ${Math.floor(diffDays / 30)} months`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Scheduled Transfers</CardTitle>
              <CardDescription>Upcoming and recurring transfers</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowNewTransfer(true)}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`skeleton-transfer-${index}-${Date.now()}`}>
                  <div className="bg-secondary/30 rounded-lg p-4 animate-pulse">
                    <div className="flex justify-between items-start">
                      <div>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-20 mb-2" />
                        <div className="flex items-center gap-1 mt-1">
                          <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-5 w-20 mt-2" />
                      </div>
                      <div className="flex gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  </div>
                  {index < 2 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          ) : scheduledTransfers.length === 0 ? (
            <div className="text-center py-8">
              <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scheduled transfers</p>
              <Button variant="link" onClick={() => setShowNewTransfer(true)}>
                Create your first scheduled transfer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledTransfers.map((transfer, index) => (
                <div key={transfer.id}>
                  <div className={cn(
                    "bg-secondary/30 rounded-lg p-4",
                    transfer.status === 'cancelled' && "opacity-60"
                  )}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">
                          {transfer.recipientName || transfer.recipient}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {transfer.amount} {transfer.token}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{format(new Date(transfer.scheduledDate), 'PPP')}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatRelativeTime(new Date(transfer.scheduledDate))})
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {transfer.recurring && transfer.frequency && (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" /> {transfer.frequency}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              transfer.status === 'pending' && "bg-yellow-500/10 text-yellow-600",
                              transfer.status === 'completed' && "bg-green-500/10 text-green-600",
                              transfer.status === 'failed' && "bg-red-500/10 text-red-600",
                              transfer.status === 'cancelled' && "bg-gray-500/10 text-gray-600"
                            )}
                          >
                            {transfer.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {transfer.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit transfer"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100"
                              title="Cancel transfer"
                              onClick={() => handleCancelTransfer(transfer.id)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img" aria-label="Cancel">
                                <title>Cancel</title>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                              </svg>
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100"
                          title="Delete transfer"
                          onClick={() => handleDeleteTransfer(transfer.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < scheduledTransfers.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="link"
            onClick={() => navigate('/app/transfer')}
            className="text-sm"
          >
            Go to Transfer page <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={showNewTransfer} onOpenChange={setShowNewTransfer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a Transfer</DialogTitle>
            <DialogDescription>
              Create a one-time or recurring transfer that will execute automatically
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateScheduled}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="recipient">Recipient</Label>
                <Input
                  id="recipient"
                  placeholder="Address or @username"
                  ref={recipientRef}
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    ref={amountRef}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="token">Token</Label>
                  <Select
                    value={selectedToken}
                    onValueChange={setSelectedToken}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="token">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDRX">IDRX</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Schedule Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                      disabled={isSubmitting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="recurring">Frequency</Label>
                <Select
                  value={selectedFrequency}
                  onValueChange={setSelectedFrequency}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="recurring">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time only</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewTransfer(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Transfer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduledTransfers;
