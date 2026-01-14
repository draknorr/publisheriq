'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CompaniesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Companies page error:', error);
  }, [error]);

  return (
    <div className="p-6">
      <Card className="p-6 border-accent-red/50 bg-accent-red/10">
        <h2 className="text-subheading text-accent-red mb-2">
          Error Loading Companies
        </h2>
        <p className="text-body text-text-secondary mb-4">
          Something went wrong while loading this page.
        </p>
        <pre className="p-4 bg-surface-raised rounded-lg text-caption text-text-muted overflow-x-auto whitespace-pre-wrap mb-4">
          {error.message || 'Unknown error'}
        </pre>
        <Button onClick={reset} variant="primary" size="sm">
          Try again
        </Button>
      </Card>
    </div>
  );
}
