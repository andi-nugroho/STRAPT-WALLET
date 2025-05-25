import {
  ArrowDown,
  ArrowUp,
  PlusCircle,
  BarChart2,
  QrCode,
  UserPlus,
  Copy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import QuickAction from "@/components/QuickAction";
import ActivityItem from "@/components/ActivityItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import UsernameRegistration from "@/components/UsernameRegistration";
import ReceivedStats from "@/components/ReceivedStats";
import QRCode from "@/components/QRCode";
import QRCodeScanner from "@/components/QRCodeScanner";
import { useXellarWallet } from "@/hooks/use-xellar-wallet";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useChainId, useConfig } from "wagmi";
import { formatUnits } from "viem";
import { liskSepolia, baseSepolia } from "viem/chains";
import { toast } from "sonner";
import BalanceSkeleton from "@/components/skeletons/BalanceSkeleton";
import ReceivedStatsSkeleton from "@/components/skeletons/ReceivedStatsSkeleton";
import ActivitySkeleton from "@/components/skeletons/ActivitySkeleton";

const Home = () => {
  const { isConnected, address } = useXellarWallet();
  const [prices, setPrices] = useState<{ [key: string]: number }>({
    'usdc': 1.0, // USDC is pegged to USD
    'idrx': 0.000065 // Example price for IDRX (adjust as needed)
  });

  // Use updated wagmi hooks for current network
  const chainId = useChainId();
  const config = useConfig();

  // Get token balances
  const { tokens, isLoading, usdcBalance, idrxBalance } = useTokenBalances();

  // Get the current chain information
  const currentChain = config.chains.find(c => c.id === chainId);

  // Fetch token prices - simplified for demo
  useEffect(() => {
    // For a real app, you would fetch prices from an API
    // For this demo, we'll use hardcoded prices
    setPrices({
      'usdc': 1.0, // USDC is pegged to USD
      'idrx': 0.000065 // Example price for IDRX
    });
  }, []);

  // Calculate USD value
  const getUSDValue = (balance: number, symbol: string): number => {
    const tokenSymbol = symbol.toLowerCase();
    const price = prices[tokenSymbol] || 0;
    return balance * price;
  };

  // Format balance with proper decimals
  const formatBalance = (
    balance: bigint | undefined,
    decimals: number,
    precision = 2
  ): string => {
    if (!balance) return "0";
    const raw = Number(formatUnits(balance, decimals));
    return raw.toFixed(precision);
  };

  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);
  const [showUsernameReg, setShowUsernameReg] = useState(false);

  // Mock data for received funds
  const receivedData = {
    totalReceived: 385.28,
    recentActivity: [
      {
        amount: 10.5,
        direction: "in",
        date: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        amount: 125,
        direction: "out",
        date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        amount: 200,
        direction: "in",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        amount: 50,
        direction: "in",
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        amount: 75,
        direction: "out",
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ] as Array<{ amount: number; direction: "in" | "out"; date: Date }>,
  };

  const handleCompleteRegistration = () => {
    setShowUsernameReg(false);
  };

  return (
    <div className="space-y-6">
      {/* Wallet Balance */}
      {isLoading ? (
        <BalanceSkeleton />
      ) : (
        <Card className="overflow-hidden dark:border-primary/20 border-primary/30">
          <CardHeader className="bg-gradient-to-r from-primary to-accent text-white">
            <CardTitle className="text-xl text-white flex items-center justify-between">
              Your Balance
              <Button
                size="sm"
                variant="ghost"
                className="text-white h-7 hover:bg-white/20"
                onClick={() => setShowQR(true)}
              >
                <QrCode className="h-4 w-4 mr-1" /> Receive
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              {!isConnected ? (
                <div className="text-sm text-muted-foreground">
                  Connect wallet to view balance
                </div>
              ) : tokens.length > 0 ? (
                <div className="space-y-4">
                  {/* IDRX Balance */}
                  {idrxBalance && (
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <img
                          src="/IDRX BLUE COIN.svg"
                          alt="IDRX"
                          className="w-8 h-8"
                        />
                        <div className="text-2xl font-bold">
                          {Number.parseInt(idrxBalance.value ? idrxBalance.value.toString() : "0")} {idrxBalance.symbol}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ≈ ${(Number.parseInt(idrxBalance.value ? idrxBalance.value.toString() : "0") * prices.idrx).toFixed(2)} USD
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No tokens found
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <Button
                variant="secondary"
                className="flex items-center gap-2 rounded-xl"
                onClick={() => navigate("/app/claims")}
              >
                <ArrowDown className="h-4 w-4" /> Claims
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <QuickAction
            icon={ArrowUp}
            label="Send"
            to="/app/transfer"
            color="bg-gradient-to-br from-primary to-accent"
          />
          <QuickAction
            icon={BarChart2}
            label="Stream Payment"
            to="/app/streams"
            color="bg-gradient-to-br from-blue-500 to-cyan-400"
          />
          <QuickAction
            icon={UserPlus}
            label="Set your STRAPT ID"
            onClick={() => setShowUsernameReg(true)}
            color="bg-gradient-to-br from-emerald-500 to-green-400"
          />
        </div>
      </div>

      {/* Received Stats */}
      {isLoading ? (
        <ReceivedStatsSkeleton />
      ) : (
        <ReceivedStats
          totalReceived={receivedData.totalReceived}
          recentActivity={receivedData.recentActivity}
        />
      )}

      {/* Recent Activity */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Recent Activity <span className="ml-3 text-xs text-amber-500 font-normal">(dummy data)</span></h2>
          <Card className="dark:border-primary/20 border-primary/30">
            <CardContent className="p-0">
              <ActivityItem
                type="sent"
                title="Sent to Mark"
                amount="-125 IDRX"
                date="2 hrs ago"
                recipient="@mark.strapt"
              />
              <ActivityItem
                type="pending"
                title="Protected Transfer"
                amount="50 IDRX"
                date="5 hrs ago"
                recipient="@alice.strapt"
              />
              <ActivityItem
                type="received"
                title="Received from Stream"
                amount="+10.5 IDRX"
                date="8 hrs ago"
              />
              <ActivityItem
                type="sent"
                title="Pool Contribution"
                amount="-75 IDRX"
                date="1 day ago"
                recipient="Trip Fund"
              />
              <ActivityItem
                type="received"
                title="Received from John"
                amount="+200 IDRX"
                date="2 days ago"
                recipient="@john.strapt"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Wallet QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4">
            <QRCode value={address || ''} size={200} />
            <p className="text-sm font-medium">Your Wallet Address</p>
            <p className="text-xs text-muted-foreground">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
            </p>
            <div className="flex flex-col w-full gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (address) {
                    navigator.clipboard.writeText(address);
                    toast.success("Address copied to clipboard");
                  }
                }}
                disabled={!address}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy Address
              </Button>
              <QRCodeScanner
                buttonVariant="outline"
                buttonText="Scan QR Code to Claim"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Username Registration Dialog */}
      <Dialog open={showUsernameReg} onOpenChange={setShowUsernameReg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Your Username</DialogTitle>
          </DialogHeader>
          <UsernameRegistration onComplete={handleCompleteRegistration} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
