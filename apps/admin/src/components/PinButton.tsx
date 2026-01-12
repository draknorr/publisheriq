'use client';

import { useState, useTransition } from 'react';
import { Pin } from 'lucide-react';

interface PinButtonProps {
  entityType: 'game' | 'publisher' | 'developer';
  entityId: number;
  displayName: string;
  isAuthenticated: boolean;
  initialPinned?: boolean;
  initialPinId?: string;
}

export function PinButton({
  entityType,
  entityId,
  displayName,
  isAuthenticated,
  initialPinned = false,
  initialPinId,
}: PinButtonProps) {
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [pinId, setPinId] = useState<string | undefined>(initialPinId);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!isAuthenticated) return;

    // Optimistic update
    const wasPinned = isPinned;
    const previousPinId = pinId;

    startTransition(async () => {
      if (wasPinned && previousPinId) {
        // Unpin
        setIsPinned(false);
        setPinId(undefined);

        try {
          const res = await fetch(`/api/pins/${previousPinId}`, { method: 'DELETE' });
          if (!res.ok) {
            // Revert on error
            setIsPinned(true);
            setPinId(previousPinId);
          }
        } catch {
          // Revert on error
          setIsPinned(true);
          setPinId(previousPinId);
        }
      } else {
        // Pin
        setIsPinned(true);

        try {
          const res = await fetch('/api/pins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityType, entityId, displayName }),
          });
          if (res.ok) {
            const data = await res.json();
            setPinId(data.id);
          } else {
            // Revert on error
            setIsPinned(false);
          }
        } catch {
          // Revert on error
          setIsPinned(false);
        }
      }
    });
  };

  const baseStyles =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors border';

  const stateStyles = isPinned
    ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/20'
    : 'text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-overlay border-border-subtle';

  const disabledStyles = !isAuthenticated || isPending ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={handleClick}
      disabled={!isAuthenticated || isPending}
      className={`${baseStyles} ${stateStyles} ${disabledStyles}`}
      title={
        !isAuthenticated
          ? 'Log in to pin'
          : isPinned
            ? 'Unpin from dashboard'
            : 'Pin to dashboard'
      }
    >
      <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
      {isPinned ? 'Pinned' : 'Pin'}
    </button>
  );
}
