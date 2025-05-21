import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowRight } from 'lucide-react';
import { useTransferContext } from '@/contexts/TransferContext';

interface ProtectionOptionsFormProps {
  onNext: () => void;
}

const ProtectionOptionsForm = ({ onNext }: ProtectionOptionsFormProps) => {
  const {
    withPassword,
    setWithPassword,
    password,
    setPassword,
    transferType,
  } = useTransferContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Shield className="h-5 w-5 mr-2 text-primary" />
          Protection Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Password protection only for claim transfers */}
        {transferType === 'claim' && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <label htmlFor="password" className="text-sm font-medium">
                    Password Protection
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {withPassword
                    ? 'Recipient must enter a password to claim funds'
                    : 'Anyone with the link can claim funds without a password'}
                </p>
              </div>
              <Switch
                id="password"
                checked={withPassword}
                onCheckedChange={setWithPassword}
              />
            </div>

            {withPassword && (
              <div className="space-y-2 pl-6">
                <label htmlFor="password-input" className="text-sm font-medium">
                  Password for Recipient
                </label>
                <Input
                  id="password-input"
                  type="password"
                  placeholder="Enter a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </>
        )}
        
        {/* Show information for direct transfers */}
        {transferType === 'direct' && (
          <div className="flex items-center">
            <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Direct transfers send tokens immediately to the recipient's wallet address. 
              No password protection is needed for direct transfers.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={onNext} className="w-full">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProtectionOptionsForm;
