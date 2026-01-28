'use client';

/**
 * Command Palette Tags View for Companies
 *
 * Full browsing and selection of tags across all categories.
 * Features:
 * - Back navigation to Home View
 * - Tag search (filters visibility)
 * - Selected tags bar
 * - Accordion categories with tag grids
 *
 * Note: Tag match mode toggle removed - not wired to URL or RPC backend
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../lib/companies-types';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteTagsProps {
  palette: UseCommandPaletteReturn;
  tagOptions: FilterOption[];
  isLoading?: boolean;
  onOpen?: () => void;
  onDone: () => void;
}

// Tag category definitions
interface TagCategory {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
}

// Define tag categories based on common Steam tag patterns
const TAG_CATEGORIES: TagCategory[] = [
  {
    id: 'popular',
    label: 'Popular',
    icon: '🔥',
    keywords: ['action', 'adventure', 'rpg', 'indie', 'simulation', 'strategy', 'casual', 'puzzle', 'multiplayer', 'singleplayer'],
  },
  {
    id: 'sub-genre',
    label: 'Sub-Genres',
    icon: '🎮',
    keywords: ['roguelike', 'roguelite', 'souls-like', 'metroidvania', 'visual novel', 'tower defense', 'turn-based', 'real-time', 'deck building', 'hack and slash'],
  },
  {
    id: 'theme',
    label: 'Themes',
    icon: '🎨',
    keywords: ['horror', 'fantasy', 'sci-fi', 'dark', 'cute', 'anime', 'post-apocalyptic', 'medieval', 'cyberpunk', 'historical'],
  },
  {
    id: 'mechanics',
    label: 'Mechanics',
    icon: '⚙️',
    keywords: ['crafting', 'building', 'survival', 'stealth', 'exploration', 'procedural', 'sandbox', 'physics', 'management', 'resource management'],
  },
  {
    id: 'style',
    label: 'Art Style',
    icon: '🖼️',
    keywords: ['pixel', 'retro', '2d', '3d', 'isometric', 'minimalist', 'realistic', 'stylized', 'cartoon', 'hand-drawn'],
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    icon: '👥',
    keywords: ['co-op', 'coop', 'pvp', 'mmo', 'online', 'local', 'competitive', 'team', 'party', 'battle royale'],
  },
  {
    id: 'other',
    label: 'Other',
    icon: '📦',
    keywords: [], // Catch-all for uncategorized
  },
];

// ============================================================================
// Component
// ============================================================================

export function CommandPaletteTags({
  palette,
  tagOptions,
  isLoading = false,
  onOpen,
  onDone,
}: CommandPaletteTagsProps) {
  const {
    state,
    goBack,
    toggleTag,
    clearTags,
    toggleSection,
  } = palette;
  const { selectedTags, expandedSections } = state;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load tags when opened
  useEffect(() => {
    if (tagOptions.length === 0 && onOpen) {
      onOpen();
    }
  }, [tagOptions.length, onOpen]);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Categorize tags
  const categorizedTags = useMemo(() => {
    const categories: Record<string, FilterOption[]> = {};
    TAG_CATEGORIES.forEach((cat) => {
      categories[cat.id] = [];
    });

    for (const tag of tagOptions) {
      const tagNameLower = tag.option_name.toLowerCase();
      let matched = false;

      for (const category of TAG_CATEGORIES) {
        if (category.id === 'other') continue;
        if (category.keywords.some((kw) => tagNameLower.includes(kw.toLowerCase()))) {
          categories[category.id].push(tag);
          matched = true;
          break;
        }
      }

      if (!matched) {
        categories['other'].push(tag);
      }
    }

    return categories;
  }, [tagOptions]);

  // Filter tags by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categorizedTags;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, FilterOption[]> = {};

    for (const [categoryId, tags] of Object.entries(categorizedTags)) {
      const matchingTags = tags.filter((tag) =>
        tag.option_name.toLowerCase().includes(query)
      );
      if (matchingTags.length > 0) {
        filtered[categoryId] = matchingTags;
      }
    }

    return filtered;
  }, [categorizedTags, searchQuery]);

  // Get selected tag names for display
  const selectedTagNames = useMemo(() => {
    return selectedTags
      .map((id) => tagOptions.find((t) => t.option_id === id)?.option_name)
      .filter(Boolean) as string[];
  }, [selectedTags, tagOptions]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="p-1.5 rounded-md hover:bg-surface-elevated transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-body font-semibold text-text-primary">Tags</h2>
              <p className="text-caption text-text-muted">
                {selectedTags.length > 0
                  ? `${selectedTags.length} selected`
                  : 'Select tags to filter results'}
              </p>
            </div>
          </div>

        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tags..."
            className="w-full pl-10 pr-4 py-2 rounded-lg
                       bg-surface-elevated border border-border-subtle
                       text-body text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>
      </div>

      {/* Selected Tags Bar */}
      {selectedTags.length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-elevated/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {selectedTagNames.slice(0, 5).map((name, index) => (
              <span
                key={selectedTags[index]}
                className="flex items-center gap-1 px-2 py-1 rounded-md
                           bg-accent-primary/20 text-accent-primary text-caption
                           whitespace-nowrap"
              >
                {name}
                <button
                  onClick={() => toggleTag(selectedTags[index])}
                  className="hover:bg-accent-primary/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedTags.length > 5 && (
              <span className="text-caption text-text-muted whitespace-nowrap">
                +{selectedTags.length - 5} more
              </span>
            )}
            <button
              onClick={clearTags}
              className="text-caption text-accent-red hover:underline whitespace-nowrap ml-auto"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="space-y-2">
            {TAG_CATEGORIES.map((category) => {
              const tags = filteredCategories[category.id] || [];
              if (tags.length === 0) return null;

              const isExpanded = expandedSections.includes(category.id);
              const selectedInCategory = tags.filter((t) =>
                selectedTags.includes(t.option_id)
              ).length;

              return (
                <div
                  key={category.id}
                  className="border border-border-subtle rounded-lg overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleSection(category.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5
                               bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span className="text-body-sm font-medium text-text-primary">
                        {category.label}
                      </span>
                      {selectedInCategory > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-accent-primary text-white text-[10px]">
                          {selectedInCategory}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-text-muted">{tags.length} tags</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </button>

                  {/* Tag Grid */}
                  {isExpanded && (
                    <div className="p-3 bg-surface border-t border-border-subtle">
                      <div className="grid grid-cols-2 gap-2">
                        {tags.map((tag) => {
                          const isSelected = selectedTags.includes(tag.option_id);
                          return (
                            <button
                              key={tag.option_id}
                              onClick={() => toggleTag(tag.option_id)}
                              className={`
                                flex items-center justify-between px-2.5 py-1.5 rounded-md
                                text-left text-body-sm transition-colors
                                ${isSelected
                                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                                  : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                                }
                              `}
                            >
                              <span className="truncate">{tag.option_name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-caption text-text-muted">
                                  {formatCount(tag.company_count)}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-surface-elevated/50">
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-muted">
            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onDone}
            className="px-4 py-2 rounded-lg bg-accent-primary text-white text-body-sm font-medium
                       hover:bg-accent-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }
  return count.toString();
}
