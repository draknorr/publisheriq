import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CompaniesLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Type toggle skeleton */}
      <Skeleton className="h-10 w-80" />

      {/* Table skeleton */}
      <Card className="p-0 overflow-hidden">
        {/* Header row */}
        <div className="bg-surface-elevated px-4 py-3 border-b border-border-subtle">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Data rows */}
        <div className="divide-y divide-border-subtle">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Footer skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
