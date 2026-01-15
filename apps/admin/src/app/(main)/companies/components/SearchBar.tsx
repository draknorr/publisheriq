'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  initialValue: string;
  onSearch: (value: string) => void;
  isPending?: boolean;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export function SearchBar({
  initialValue,
  onSearch,
  isPending = false,
  placeholder = 'Search companies by name...',
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal value when initialValue changes (e.g., from URL)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounced search
      debounceRef.current = setTimeout(() => {
        onSearch(newValue);
      }, DEBOUNCE_MS);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setValue('');
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    // Immediate clear
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
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-surface-elevated border border-border-subtle rounded-lg
                   text-body text-text-primary placeholder:text-text-muted
                   focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary
                   transition-colors"
      />
      {value && (
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
