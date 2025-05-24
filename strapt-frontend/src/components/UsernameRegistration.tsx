
import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface UsernameRegistrationProps {
  onComplete: () => void;
}

const UsernameRegistration = ({ onComplete }: UsernameRegistrationProps) => {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Mock function to check username availability
  const checkUsernameAvailability = async (username: string) => {
    setChecking(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    const isAvailable = username.length >= 3 && !['admin', 'system', 'truststream'].includes(username.toLowerCase());
    setChecking(false);
    setAvailable(isAvailable);
    return isAvailable;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim().toLowerCase();
    setUsername(value);
    setAvailable(null);

    // Debounce the availability check
    if (value.length >= 3) {
      const timer = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);
    const isAvailable = await checkUsernameAvailability(username);

    if (isAvailable) {
      // Move directly to completion step
      setChecking(false);
      nextStep();
    } else {
      toast({
        title: "Username Unavailable",
        description: "Please choose another username",
        variant: "destructive",
      });
      setChecking(false);
    }
  };

  const nextStep = () => {
    setProgress((step / 2) * 100);
    setStep(2); // We now only have 2 steps: username selection and completion
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(1);
      setProgress(0);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Registration Complete",
      description: `@${username}.strapt is now yours!`,
    });
    onComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register Your Username</CardTitle>
        <CardDescription>Create your on-chain identity</CardDescription>
        <Progress value={progress} className="h-1 mt-2" />
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    placeholder="username"
                    value={username}
                    onChange={handleUsernameChange}
                    className="pr-20"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    .strapt
                  </div>
                </div>

                {username && username.length >= 3 && (
                  <div className="flex items-center text-sm mt-2">
                    {checking ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        <span className="text-muted-foreground">Checking availability...</span>
                      </>
                    ) : available === true ? (
                      <>
                        <Check className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-green-500">Username available!</span>
                      </>
                    ) : available === false ? (
                      <span className="text-destructive">Username unavailable</span>
                    ) : null}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  Choose a username for your wallet. This will be your public identity on STRAPT.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Username Requirements:</p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  <li>At least 3 characters</li>
                  <li>Only lowercase letters, numbers and underscores</li>
                  <li>Cannot be changed later</li>
                </ul>
              </div>
            </div>

            <div className="mt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={checking || !username || username.length < 3 || available === false}
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Check className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-medium">Registration Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your username @{username}.strapt is now registered
              </p>
            </div>

            <div className="space-y-1 bg-secondary/30 p-3 rounded-md">
              <p className="text-sm font-medium">What happens next:</p>
              <ul className="text-xs text-muted-foreground list-disc pl-5">
                <li>Your username will be linked to your current wallet address</li>
                <li>You can use this username to send and receive payments</li>
                <li>Others can find you using @{username}.strapt</li>
              </ul>
            </div>

            {/* <div className="flex justify-center">
              <Avatar className="h-16 w-16 border-2 border-primary">
                <AvatarFallback className="text-xl">{username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={prevStep}
            >
              Go Back
            </Button> */}
          </div>
        )}
      </CardContent>
      {step === 2 && (
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleComplete}
          >
            Start Using STRAPT
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default UsernameRegistration;
