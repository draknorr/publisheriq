'use client';

/**
 * Command Palette - Main Wrapper Component
 *
 * A unified filter interface accessed via ⌘K that serves as the primary
 * entry point for all filtering operations. Supports multiple views that
 * morph based on user intent.
 */

import { useEffect, useRef, useCallback } from 'react';
import { CommandPaletteHome } from './CommandPaletteHome';
import { CommandPaletteTags } from './CommandPaletteTags';
import { CommandPaletteGenres } from './CommandPaletteGenres';
import { CommandPaletteCategories } from './CommandPaletteCategories';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../hooks/useFilterCounts';
import type { PresetId, QuickFilterId } from '../../lib/apps-types';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteProps {
  palette: UseCommandPaletteReturn;
  // Filter data
  tagOptions: FilterOption[];
  genreOptions: FilterOption[];
  categoryOptions: FilterOption[];
  // Loading states
  tagsLoading?: boolean;
  genresLoading?: boolean;
  categoriesLoading?: boolean;
  // Data fetch triggers
  onTagsOpen?: () => void;
  onGenresOpen?: () => void;
  onCategoriesOpen?: () => void;
  // Preset/Quick filter actions
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];
  onApplyPreset: (id: PresetId) => void;
  onToggleQuickFilter: (id: QuickFilterId) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CommandPalette({
  palette,
  tagOptions,
  genreOptions,
  categoryOptions,
  tagsLoading = false,
  genresLoading = false,
  categoriesLoading = false,
  onTagsOpen,
  onGenresOpen,
  onCategoriesOpen,
  activePreset,
  activeQuickFilters,
  onApplyPreset,
  onToggleQuickFilter,
}: CommandPaletteProps) {
  const { state, close, goBack, applyContentSelections } = palette;
  const { isOpen, view } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // -------------------------------------------------------------------------
  // Keyboard handling
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (view !== 'home') {
          goBack();
        } else {
          close();
        }
      }
    },
    [isOpen, view, goBack, close]
  );

  // Attach keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // -------------------------------------------------------------------------
  // Focus management
  // -------------------------------------------------------------------------

  // Store active element when opening, restore when closing
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the container for keyboard navigation
      setTimeout(() => {
        containerRef.current?.focus();
      }, 0);
    } else {
      // Restore focus to previous element
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!isOpen) return null;

  // Determine width based on view
  const containerWidth = view === 'home' ? 'max-w-lg' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={close}
        aria-hidden="true"
      />

      {/* Centering container */}
      <div className="flex min-h-full items-start justify-center p-4 sm:pt-[10vh]">
        {/* Palette container */}
        <div
          ref={containerRef}
          tabIndex={-1}
          className={`
            relative w-full ${containerWidth}
            bg-surface-raised rounded-xl shadow-2xl
            border border-border-subtle
            transition-all duration-200 ease-out
            focus:outline-none
            overflow-hidden
          `}
          role="dialog"
          aria-modal="true"
          aria-label="Filter command palette"
        >
          {/* View content */}
          <div className="max-h-[70vh] overflow-y-auto">
            {view === 'home' && (
              <CommandPaletteHome
                palette={palette}
                genreOptions={genreOptions}
                genresLoading={genresLoading}
                onGenresOpen={onGenresOpen}
                activePreset={activePreset}
                activeQuickFilters={activeQuickFilters}
                onApplyPreset={onApplyPreset}
                onToggleQuickFilter={onToggleQuickFilter}
              />
            )}

            {view === 'tags' && (
              <CommandPaletteTags
                palette={palette}
                tagOptions={tagOptions}
                isLoading={tagsLoading}
                onOpen={onTagsOpen}
                onDone={applyContentSelections}
              />
            )}

            {view === 'genres' && (
              <CommandPaletteGenres
                palette={palette}
                genreOptions={genreOptions}
                isLoading={genresLoading}
                onOpen={onGenresOpen}
                onDone={applyContentSelections}
              />
            )}

            {view === 'categories' && (
              <CommandPaletteCategories
                palette={palette}
                categoryOptions={categoryOptions}
                isLoading={categoriesLoading}
                onOpen={onCategoriesOpen}
                onDone={applyContentSelections}
              />
            )}
          </div>

          {/* Keyboard hints footer */}
          <div className="px-4 py-2 border-t border-border-subtle bg-surface-elevated/50">
            <div className="flex items-center justify-between text-caption text-text-muted">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[10px]">
                    ↑↓
                  </kbd>
                  {' '}Navigate
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[10px]">
                    Enter
                  </kbd>
                  {' '}Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[10px]">
                    Esc
                  </kbd>
                  {' '}{view !== 'home' ? 'Back' : 'Close'}
                </span>
              </div>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-subtle text-[10px]">
                  ⌘K
                </kbd>
                {' '}to toggle
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
