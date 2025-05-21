import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const ReceivedStatsSkeleton = () => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-primary" />
          Funds Received
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/20 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Received</div>
              <Skeleton className="h-8 w-24 mt-1" />
            </div>
            <div className="bg-secondary/20 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Last 7 Days</div>
              <Skeleton className="h-8 w-24 mt-1" />
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
            <div className="space-y-2">
              {Array(4).fill(0).map((_, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Skeleton className="h-4 w-4 mr-2 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceivedStatsSkeleton;
