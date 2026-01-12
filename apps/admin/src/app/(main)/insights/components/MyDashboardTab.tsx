'use client';

import { useEffect, useState } from 'react';
import { Pin, ArrowRight, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { AlertFeed } from '@/components/alerts/AlertFeed';
import { AlertPreferencesModal } from '@/components/alerts/AlertPreferencesModal';
import { PinnedCard } from './PinnedCard';

interface PinnedEntity {
  pin_id: string;
  entity_type: 'game' | 'publisher' | 'developer';
  entity_id: number;
  display_name: string;
  pin_order: number;
  pinned_at: string;
  ccu_current: number | null;
  ccu_change_pct: number | null;
  total_reviews: number | null;
  positive_pct: number | null;
  review_velocity: number | null;
  trend_direction: string | null;
  price_cents: number | null;
  discount_percent: number | null;
}

export function MyDashboardTab() {
  const [pins, setPins] = useState<PinnedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const fetchPins = async () => {
      try {
        const res = await fetch('/api/pins');
        if (res.status === 401) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch pins');
        }
        const data = await res.json();
        setPins(data);
      } catch (err) {
        console.error('Error fetching pins:', err);
        setError('Failed to load pinned items');
      } finally {
        setLoading(false);
      }
    };

    fetchPins();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Alert skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-32 bg-surface-elevated rounded animate-pulse" />
          <div className="h-24 bg-surface-elevated rounded-lg animate-pulse" />
        </div>
        {/* Pins skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-24 bg-surface-elevated rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-surface-elevated rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <Pin className="h-12 w-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-subheading text-text-primary mb-2">Sign in to access your dashboard</h3>
        <p className="text-body-sm text-text-secondary max-w-md mx-auto">
          Pin games, publishers, and developers to create your personalized dashboard.
          Sign in to get started.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="text-center py-12">
        <Pin className="h-12 w-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-subheading text-text-primary mb-2">No pinned items yet</h3>
        <p className="text-body-sm text-text-secondary max-w-md mx-auto mb-6">
          Pin games, publishers, or developers from their detail pages to see them here.
          Pinned items show at-a-glance metrics and notify you of significant changes.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center text-body-sm">
          <a
            href="/apps"
            className="inline-flex items-center gap-1 text-accent-blue hover:underline"
          >
            Browse games <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <span className="text-text-muted hidden sm:inline">|</span>
          <a
            href="/publishers"
            className="inline-flex items-center gap-1 text-accent-blue hover:underline"
          >
            Browse publishers <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <span className="text-text-muted hidden sm:inline">|</span>
          <a
            href="/developers"
            className="inline-flex items-center gap-1 text-accent-blue hover:underline"
          >
            Browse developers <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // Group pins by entity type for display
  const gamePins = pins.filter((p) => p.entity_type === 'game');
  const publisherPins = pins.filter((p) => p.entity_type === 'publisher');
  const developerPins = pins.filter((p) => p.entity_type === 'developer');

  return (
    <div className="space-y-6">
      {/* Recent Alerts Section */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Alerts</CardTitle>
            <button
              onClick={() => setShowPreferences(true)}
              className="p-1.5 -m-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
              aria-label="Alert preferences"
              title="Alert preferences"
            >
              <Settings className="h-4 w-4 text-text-muted hover:text-text-secondary" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <AlertFeed limit={5} />
        </CardContent>
      </Card>

      {/* Alert Preferences Modal */}
      <AlertPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />

      {/* Pinned Items Section */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle>Pinned Items</CardTitle>
            <span className="text-body-sm text-text-muted">{pins.length} items</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {/* Show all pins in a responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pins.map((pin) => (
              <PinnedCard key={pin.pin_id} pin={pin} />
            ))}
          </div>

          {/* Optional: Summary by type */}
          {(gamePins.length > 0 || publisherPins.length > 0 || developerPins.length > 0) && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-border-subtle text-caption text-text-muted">
              {gamePins.length > 0 && <span>{gamePins.length} games</span>}
              {publisherPins.length > 0 && <span>{publisherPins.length} publishers</span>}
              {developerPins.length > 0 && <span>{developerPins.length} developers</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
