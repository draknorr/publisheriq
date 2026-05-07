import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';

export default function UnreleasedLoading() {
  return (
    <div className="space-y-5">
      <SkeletonCard />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <SkeletonTable rows={8} columns={8} />
    </div>
  );
}
