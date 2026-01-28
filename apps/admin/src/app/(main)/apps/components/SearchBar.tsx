'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  initialValue: string;
  onSearch: (value: string) => void;
  isPending?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Debounced search input for the Games page
 * Parent hook (useAppsFilters) handles the 700ms debounce for URL updates
 */
export function SearchBar({
  initialValue,
  onSearch,
  isPending = false,
  placeholder = 'Search games by name...',
  disabled = false,
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track focus state to prevent prop sync while user is typing
  const isFocusedRef = useRef(false);
  // Track if user was recently typing (survives blur events during re-render)
  const recentlyTypedRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track previous pending state to detect when loading finishes
  const wasPendingRef = useRef(false);

  // Sync internal value when initialValue changes (but not while focused)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialValue);
    }
  }, [initialValue]);

  // Restore focus when loading completes (isPending: true -> false)
  useEffect(() => {
    if (wasPendingRef.current && !isPending && recentlyTypedRef.current) {
      // Use setTimeout to ensure DOM has fully settled (works better in Firefox)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
    wasPendingRef.current = isPending;
  }, [isPending]);

  // Mark user as recently typing (keeps flag for 2 seconds after last keystroke)
  const markRecentlyTyped = useCallback(() => {
    recentlyTypedRef.current = true;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      recentlyTypedRef.current = false;
    }, 2000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      markRecentlyTyped();
      // Call parent immediately - hook handles debouncing
      onSearch(newValue);
    },
    [onSearch, markRecentlyTyped]
  );

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {isPending ? (
          <div className="w-5 h-5 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="w-5 h-5 text-text-muted" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pl-10 pr-10 py-2.5 bg-surface-elevated border border-border-subtle rounded-lg
                   text-body text-text-primary placeholder:text-text-muted
                   focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      />
      {value && !disabled && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-primary transition-colors"
          title="Clear search"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
