
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Link, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDecentralizedIdentity } from '@/hooks/use-decentralized-identity';
import { Skeleton } from '@/components/ui/skeleton';

const DecentralizedIdentity = () => {
  const {
    connectedAccounts,
    isLoading,
    connectAccount,
    disconnectAccount,
    getAvailableProviders,
    identityProviders
  } = useDecentralizedIdentity();

  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async (providerId: string) => {
    setIsConnecting(providerId);

    try {
      // Simulate a connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Connect the account
      connectAccount(providerId);

      toast({
        title: "Connection successful",
        description: `Connected to ${identityProviders.find(p => p.id === providerId)?.name}`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "There was an error connecting to the provider",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = (accountId: string) => {
    disconnectAccount(accountId);

    toast({
      title: "Account disconnected",
      description: "The account has been disconnected",
      duration: 3000,
    });
  };

  const getAvatarFallback = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Connected Identities</CardTitle>
          <CardDescription>
            Your Web3 identities connected to this account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading state
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`skeleton-identity-${index}-${Date.now()}`} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              ))}
            </div>
          ) : connectedAccounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No connected identities</p>
          ) : (
            <div className="space-y-3">
              {connectedAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={account.iconUrl} />
                      <AvatarFallback>{getAvatarFallback(account.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        {account.verified && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.handle}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="View profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-100"
                      title="Disconnect"
                      onClick={() => handleDisconnect(account.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img" aria-label="Disconnect">
                        <title>Disconnect</title>
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Available Connections</CardTitle>
          <CardDescription>Connect with more decentralized identity providers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading state
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`skeleton-provider-${index}-${Date.now()}`} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {getAvailableProviders().map(provider => (
                <div key={provider.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getAvatarFallback(provider.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(provider.id)}
                    disabled={isConnecting === provider.id}
                  >
                    {isConnecting === provider.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Connecting...
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 mr-1" /> Connect
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {getAvailableProviders().length === 0 && (
                <p className="text-center text-muted-foreground py-4">No more providers available to connect</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="link" className="mx-auto">
            Learn more about decentralized identity <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DecentralizedIdentity;
