'use client';

import { forwardRef } from 'react';
import { Search, Sparkles, Gamepad2 } from 'lucide-react';
import { highlightMatch } from '@/lib/chat/query-templates';
import type { ChatEntitySuggestion } from '@/lib/chat/chat-entity-picker';

export type AutocompleteSuggestion = ChatEntitySuggestion;

interface AutocompleteDropdownProps {
  continuationToken?: string | null;
  inputValue: string;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  isVisible: boolean;
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  totalCandidates?: number | null;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  onHover: (index: number) => void;
  onLoadMore?: () => void;
}

export const AutocompleteDropdown = forwardRef<HTMLDivElement, AutocompleteDropdownProps>(
  function AutocompleteDropdown(
    {
      continuationToken,
      inputValue,
      isLoading,
      isLoadingMore,
      isVisible,
      suggestions,
      selectedIndex,
      totalCandidates,
      onSelect,
      onHover,
      onLoadMore,
    },
    ref
  ) {
    if (!isVisible) return null;

    // Group suggestions by category
    const grouped = groupSuggestions(suggestions);

    return (
      <div
        ref={ref}
        className="absolute bottom-full left-0 right-0 mb-2 bg-surface-raised border border-border-muted rounded-lg shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
        role="listbox"
      >
        {isLoading && suggestions.length === 0 && (
          <div className="px-4 py-3 text-body-sm text-text-muted flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
            Searching...
          </div>
        )}

        {!isLoading && suggestions.length === 0 && inputValue.length >= 2 && (
          <div className="px-4 py-3 text-body-sm text-text-muted">
            No suggestions found
          </div>
        )}

        {grouped.map((group, groupIndex) => (
          <div key={group.category}>
            {groupIndex > 0 && <div className="border-t border-border-subtle" />}
            <div className="px-3 py-1.5 text-caption text-text-muted bg-surface-elevated flex items-center gap-1.5">
              <CategoryIcon category={group.category} />
              {getCategoryLabel(group.category)}
            </div>
            {group.items.map((suggestion) => {
              const globalIndex = suggestions.indexOf(suggestion);
              const isSelected = globalIndex === selectedIndex;

              return (
                <button
                  key={`${suggestion.category}-${suggestion.label}`}
                  type="button"
                  className={`
                    w-full px-4 py-2 text-left text-body-sm
                    transition-colors cursor-pointer
                    ${isSelected ? 'chat-accent-soft text-text-primary' : 'text-text-secondary hover:bg-surface-elevated'}
                  `}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(suggestion)}
                  onMouseEnter={() => onHover(globalIndex)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <HighlightedText text={suggestion.label} highlight={inputValue} />
                    {suggestion.description && (
                      <span className="text-caption text-text-muted">
                        {suggestion.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {(continuationToken || (typeof totalCandidates === 'number' && totalCandidates > suggestions.length)) && (
          <div className="border-t border-border-subtle bg-surface-elevated px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption text-text-muted">
                {typeof totalCandidates === 'number' && totalCandidates > 0
                  ? `Showing ${suggestions.length} of ${totalCandidates} matches`
                  : 'More matches are available'}
              </p>
              {continuationToken && onLoadMore && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onLoadMore}
                  className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-base px-3 py-1.5 text-caption font-medium text-text-secondary transition-colors hover:border-border-muted hover:text-text-primary"
                >
                  {isLoadingMore && (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
                  )}
                  Show more matches
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'template':
    case 'example':
      return <Sparkles className="w-3 h-3" />;
    case 'game':
      return <Gamepad2 className="w-3 h-3" />;
    default:
      return <Search className="w-3 h-3" />;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'entity':
      return 'Matched entities';
    case 'template':
      return 'Suggested queries';
    case 'example':
      return 'Try asking';
    case 'tag':
      return 'Tags';
    case 'game':
      return 'Games';
    case 'publisher':
      return 'Publishers';
    case 'developer':
      return 'Developers';
    default:
      return 'Suggestions';
  }
}

interface GroupedSuggestions {
  category: string;
  items: AutocompleteSuggestion[];
}

function groupSuggestions(suggestions: AutocompleteSuggestion[]): GroupedSuggestions[] {
  const groups: Map<string, AutocompleteSuggestion[]> = new Map();

  // Priority order for categories
  const categoryOrder = ['entity', 'example', 'template', 'tag', 'game', 'publisher', 'developer'];

  for (const suggestion of suggestions) {
    const existing = groups.get(suggestion.category) || [];
    existing.push(suggestion);
    groups.set(suggestion.category, existing);
  }

  return categoryOrder
    .filter(cat => groups.has(cat))
    .map(category => ({
      category,
      items: groups.get(category)!,
    }));
}

function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  const segments = highlightMatch(text, highlight);

  return (
    <span>
      {segments.map((segment, i) => (
        segment.isMatch ? (
          <span key={i} className="chat-accent-icon font-medium">{segment.text}</span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      ))}
    </span>
  );
}
