'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui';

export default function PublishersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Publishers page error:', error);
  }, [error]);

  return (
    <div className="p-6">
      <Card className="p-6 border-accent-red/50 bg-accent-red/10">
        <h2 className="text-subheading text-accent-red mb-2">Error Loading Publishers</h2>
        <p className="text-body text-text-secondary mb-4">
          Something went wrong while loading this page.
        </p>
        <pre className="p-4 bg-surface-raised rounded-lg text-caption text-text-muted overflow-x-auto whitespace-pre-wrap">
          {error.message || 'Unknown error'}
          {error.digest && `\n\nDigest: ${error.digest}`}
        </pre>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 bg-accent-blue text-white rounded-md text-body-sm font-medium hover:bg-accent-blue/90"
        >
          Try again
        </button>
      </Card>
    </div>
  );
}
