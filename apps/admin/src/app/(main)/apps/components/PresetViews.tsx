'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PresetId } from '../lib/apps-types';
import { PRESETS } from '../lib/apps-presets';

interface PresetViewsProps {
  activePreset: PresetId | null;
  onSelectPreset: (presetId: PresetId) => void;
  onClearPreset: () => void;
  disabled?: boolean;
}

/**
 * Horizontally scrollable preset view buttons
 * Presets are exclusive (selecting one clears others and applies sort)
 */
export function PresetViews({
  activePreset,
  onSelectPreset,
  onClearPreset,
  disabled = false,
}: PresetViewsProps) {
  // Scroll state for arrow indicators
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  // Update on mount and resize
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleClick = (presetId: PresetId) => {
    if (activePreset === presetId) {
      // Toggle off
      onClearPreset();
    } else {
      onSelectPreset(presetId);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Left scroll arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy('left')}
          className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto scrollbar-none"
      >
        <div className="flex items-center gap-2">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const label = preset.emoji ? `${preset.emoji} ${preset.label}` : preset.label;

            return (
              <button
                key={preset.id}
                onClick={() => handleClick(preset.id)}
                disabled={disabled}
                title={preset.tooltip}
                className={`
                  flex-shrink-0 px-3 py-1.5 rounded-full text-body-sm font-medium
                  transition-colors whitespace-nowrap
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isActive
                      ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'
                      : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:border-border-prominent hover:text-text-primary'
                  }
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right scroll arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy('right')}
          className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
