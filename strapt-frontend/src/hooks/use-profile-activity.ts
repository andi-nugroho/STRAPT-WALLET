import { useState, useEffect, useCallback } from 'react';
import { useXellarWallet } from './use-xellar-wallet';
import { useSentTransfersData, useReceivedTransfersData } from '@/services/TransfersDataService';
import { useStreamsData } from '@/services/StreamsDataService';
import { useStraptDrop } from './use-strapt-drop';

// Define the activity type
export interface ProfileActivity {
  id: string;
  type: 'transfer' | 'claim' | 'stream' | 'pool' | 'drop';
  title: string;
  amount: string;
  status: 'completed' | 'pending' | 'active' | 'failed';
  timestamp: string;
}

// Mock activities for fallback
const mockActivities: ProfileActivity[] = [
  {
    id: '1',
    type: 'transfer',
    title: 'Transfer sent to Sarah',
    amount: '245 SEI',
    status: 'completed',
    timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: '2',
    type: 'claim',
    title: 'Protected transfer created',
    amount: '100 SEI',
    status: 'pending',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '3',
    type: 'stream',
    title: 'Stream payment to Team',
    amount: '500 SEI',
    status: 'active',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '4',
    type: 'pool',
    title: 'Group pool contribution',
    amount: '50 SEI',
    status: 'completed',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '5',
    type: 'transfer',
    title: 'Transfer received from Alex',
    amount: '75 SEI',
    status: 'completed',
    timestamp: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: '6',
    type: 'claim',
    title: 'Transfer claim expired',
    amount: '15 SEI',
    status: 'failed',
    timestamp: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
];

/**
 * Hook to get profile activity data
 * Combines data from transfers, streams, and drops
 */
export function useProfileActivity() {
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useXellarWallet();
  
  // Get transfers data
  const { transfers: sentTransfers, isLoading: isSentLoading } = useSentTransfersData();
  const { transfers: receivedTransfers, isLoading: isReceivedLoading } = useReceivedTransfersData();
  
  // Get streams data
  const { streams, isLoading: isStreamsLoading } = useStreamsData();
  
  // Get STRAPT drops data
  const { getUserCreatedDrops, isLoadingUserDrops } = useStraptDrop();
  const [drops, setDrops] = useState<any[]>([]);
  
  // Fetch drops data
  useEffect(() => {
    const fetchDrops = async () => {
      if (!address) return;
      
      try {
        const userDrops = await getUserCreatedDrops();
        setDrops(userDrops || []);
      } catch (error) {
        console.error('Error fetching user drops:', error);
        setDrops([]);
      }
    };
    
    fetchDrops();
  }, [address, getUserCreatedDrops]);
  
  // Combine all activity data
  useEffect(() => {
    const combineActivityData = () => {
      if (!address) {
        setActivities(mockActivities);
        setIsLoading(false);
        return;
      }
      
      // Check if all data is loaded
      if (isSentLoading || isReceivedLoading || isStreamsLoading || isLoadingUserDrops) {
        return;
      }
      
      const allActivities: ProfileActivity[] = [];
      
      // Add sent transfers
      if (sentTransfers && sentTransfers.length > 0) {
        sentTransfers.forEach(transfer => {
          allActivities.push({
            id: `transfer-sent-${transfer.id}`,
            type: 'transfer',
            title: `Transfer sent to ${transfer.recipient ? `${transfer.recipient.slice(0, 6)}...${transfer.recipient.slice(-4)}` : 'recipient'}`,
            amount: `${transfer.amount} ${transfer.tokenSymbol || 'tokens'}`,
            status: transfer.status === 'Claimed' ? 'completed' : 
                   transfer.status === 'Refunded' ? 'failed' : 'pending',
            timestamp: new Date(Number(transfer.createdAt) * 1000).toISOString(),
          });
        });
      }
      
      // Add received transfers
      if (receivedTransfers && receivedTransfers.length > 0) {
        receivedTransfers.forEach(transfer => {
          allActivities.push({
            id: `transfer-received-${transfer.id}`,
            type: 'claim',
            title: `Transfer received from ${transfer.sender ? `${transfer.sender.slice(0, 6)}...${transfer.sender.slice(-4)}` : 'sender'}`,
            amount: `${transfer.amount} ${transfer.tokenSymbol || 'tokens'}`,
            status: transfer.status === 'Claimed' ? 'completed' : 
                   transfer.status === 'Refunded' ? 'failed' : 'pending',
            timestamp: new Date(Number(transfer.createdAt) * 1000).toISOString(),
          });
        });
      }
      
      // Add streams
      if (streams && streams.length > 0) {
        streams.forEach(stream => {
          allActivities.push({
            id: `stream-${stream.streamId}`,
            type: 'stream',
            title: stream.sender === address 
              ? `Stream payment to ${stream.recipient.slice(0, 6)}...${stream.recipient.slice(-4)}`
              : `Stream payment from ${stream.sender.slice(0, 6)}...${stream.sender.slice(-4)}`,
            amount: `${stream.totalAmount} ${stream.tokenSymbol || 'tokens'}`,
            status: stream.status === 'Active' ? 'active' : 
                   stream.status === 'Completed' ? 'completed' : 
                   stream.status === 'Cancelled' ? 'failed' : 'pending',
            timestamp: new Date(Number(stream.startTime) * 1000).toISOString(),
          });
        });
      }
      
      // Add drops
      if (drops && drops.length > 0) {
        drops.forEach(drop => {
          allActivities.push({
            id: `drop-${drop.id}`,
            type: 'drop',
            title: `STRAPT Drop created`,
            amount: `${Number(drop.info.totalAmount) / (10 ** (drop.info.tokenAddress === '0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661' ? 2 : 6))} ${drop.info.tokenAddress === '0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661' ? 'IDRX' : 'USDC'}`,
            status: drop.info.isActive ? 'active' : 
                   drop.info.remainingAmount === BigInt(0) ? 'completed' : 'pending',
            timestamp: new Date(Number(drop.info.expiryTime) * 1000 - 86400000).toISOString(), // 24 hours before expiry
          });
        });
      }
      
      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // If we have real data, use it; otherwise, fall back to mock data
      if (allActivities.length > 0) {
        setActivities(allActivities);
      } else {
        setActivities(mockActivities);
      }
      
      setIsLoading(false);
    };
    
    combineActivityData();
  }, [
    address, 
    sentTransfers, 
    receivedTransfers, 
    streams, 
    drops,
    isSentLoading, 
    isReceivedLoading, 
    isStreamsLoading, 
    isLoadingUserDrops
  ]);
  
  return { activities, isLoading };
}
