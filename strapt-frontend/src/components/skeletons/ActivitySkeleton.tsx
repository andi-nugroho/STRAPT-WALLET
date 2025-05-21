import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const ActivityItemSkeleton = () => {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl">
      <div className="flex items-center">
        <Skeleton className="rounded-full h-9 w-9 mr-3" />
        <div>
          <Skeleton className="h-5 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
};

const ActivitySkeleton = () => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-32" />
      </div>
      <Card className="dark:border-primary/20 border-primary/30">
        <CardContent className="p-0">
          {Array(5).fill(0).map((_, index) => (
            <ActivityItemSkeleton key={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivitySkeleton;
