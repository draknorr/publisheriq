'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Repeat,
  MessageSquare,
  ThumbsUp,
  DollarSign,
  Rocket,
  Award,
  Bell,
  X,
} from 'lucide-react';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  created_at: string;
  is_read: boolean;
  user_pins: {
    display_name: string;
    entity_type: 'game' | 'publisher' | 'developer';
    entity_id: number;
  } | null;
}

interface AlertFeedProps {
  limit?: number;
  onCountChange?: () => void;
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case 'ccu_spike':
      return <TrendingUp className="h-4 w-4 text-accent-green" />;
    case 'ccu_drop':
      return <TrendingDown className="h-4 w-4 text-accent-red" />;
    case 'trend_reversal':
      return <Repeat className="h-4 w-4 text-accent-purple" />;
    case 'review_surge':
      return <MessageSquare className="h-4 w-4 text-accent-cyan" />;
    case 'sentiment_shift':
      return <ThumbsUp className="h-4 w-4 text-accent-yellow" />;
    case 'price_change':
      return <DollarSign className="h-4 w-4 text-accent-green" />;
    case 'new_release':
      return <Rocket className="h-4 w-4 text-accent-blue" />;
    case 'milestone':
      return <Award className="h-4 w-4 text-accent-purple" />;
    default:
      return <Bell className="h-4 w-4 text-text-secondary" />;
  }
}

function getEntityHref(entityType: string, entityId: number): string {
  switch (entityType) {
    case 'game':
      return `/apps/${entityId}`;
    case 'publisher':
      return `/publishers/${entityId}`;
    case 'developer':
      return `/developers/${entityId}`;
    default:
      return '#';
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSeverityStyles(severity: string): string {
  switch (severity) {
    case 'high':
      return 'border-l-accent-red';
    case 'medium':
      return 'border-l-accent-yellow';
    case 'low':
    default:
      return 'border-l-border-subtle';
  }
}

export function AlertFeed({ limit = 5, onCountChange }: AlertFeedProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/alerts?limit=${limit}`);
        if (res.status === 401) {
          // User not authenticated - show empty state
          setAlerts([]);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch alerts');
        }
        const data = await res.json();
        setAlerts(data);
      } catch (err) {
        console.error('Error fetching alerts:', err);
        setError('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [limit]);

  const handleDismiss = (alertId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update - remove from list immediately
    const previousAlerts = alerts;
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    startTransition(async () => {
      try {
        const res = await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' });
        if (!res.ok) {
          // Revert on error
          setAlerts(previousAlerts);
        } else {
          // Notify parent to refresh count
          onCountChange?.();
        }
      } catch {
        // Revert on error
        setAlerts(previousAlerts);
      }
    });
  };

  const handleMarkAsRead = async (alertId: string) => {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );

    try {
      await fetch(`/api/alerts/${alertId}/read`, { method: 'POST' });
      onCountChange?.();
    } catch {
      // Silent fail - user is navigating away anyway
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-14 bg-surface-elevated rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-text-secondary">
        <p className="text-body-sm">{error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-6 border border-border-subtle rounded-lg bg-surface-raised">
        <Bell className="h-8 w-8 text-text-muted mx-auto mb-2" />
        <p className="text-body-sm text-text-secondary">No alerts yet</p>
        <p className="text-caption text-text-muted mt-1">
          Alerts will appear here when your pinned items have significant changes
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${isPending ? 'opacity-70' : ''}`}>
      {alerts.map((alert) => {
        const href = alert.user_pins
          ? getEntityHref(alert.user_pins.entity_type, alert.user_pins.entity_id)
          : '#';

        return (
          <div
            key={alert.id}
            className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-lg border-l-2 ${getSeverityStyles(alert.severity)} bg-surface-elevated hover:bg-surface-overlay transition-colors ${!alert.is_read ? 'bg-accent-blue/5' : ''}`}
          >
            <Link
              href={href}
              onClick={() => handleMarkAsRead(alert.id)}
              className="absolute inset-0 rounded-lg"
              aria-label={`View ${alert.user_pins?.display_name || 'alert'}`}
            />
            <div className="flex-shrink-0 mt-0.5 relative z-10 pointer-events-none">
              {getAlertIcon(alert.alert_type)}
            </div>
            <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
              <p className={`text-body-sm line-clamp-1 ${!alert.is_read ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                {alert.title}
              </p>
              <p className="text-caption text-text-muted line-clamp-1">
                {alert.user_pins?.display_name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
              <span className="text-caption text-text-muted">
                {formatRelativeTime(alert.created_at)}
              </span>
              <button
                onClick={(e) => handleDismiss(alert.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 -m-1 rounded hover:bg-surface-overlay transition-opacity"
                aria-label="Dismiss alert"
              >
                <X className="h-3.5 w-3.5 text-text-muted hover:text-text-secondary" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
