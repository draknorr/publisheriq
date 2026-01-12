'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface AlertBadgeProps {
  isAuthenticated: boolean;
}

export function AlertBadge({ isAuthenticated }: AlertBadgeProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/alerts/count');
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch (err) {
        console.error('Error fetching alert count:', err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchCount();

    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated || loading) {
    return null;
  }

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <Link
      href="/insights?tab=dashboard"
      className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-elevated transition-colors"
      aria-label={count > 0 ? `${count} unread alerts` : 'No unread alerts'}
    >
      <Bell className="h-4.5 w-4.5 text-text-secondary" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-medium text-white">
          {displayCount}
        </span>
      )}
    </Link>
  );
}
