import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

const BalanceSkeleton = () => {
  return (
    <Card className="overflow-hidden dark:border-primary/20 border-primary/30">
      <CardHeader className="bg-gradient-to-r from-primary to-accent text-white">
        <CardTitle className="text-xl text-white flex items-center justify-between">
          Your Balance
          <Button
            size="sm"
            variant="ghost"
            className="text-white h-7 hover:bg-white/20"
            disabled
          >
            <QrCode className="h-4 w-4 mr-1" /> Receive
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceSkeleton;
