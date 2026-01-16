import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AppsLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Type toggle skeleton */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Content skeleton */}
      <Card className="p-0 overflow-hidden">
        {/* Header row */}
        <div className="bg-surface-elevated px-4 py-3 border-b border-border-subtle">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Data rows */}
        <div className="divide-y divide-border-subtle">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Footer skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
