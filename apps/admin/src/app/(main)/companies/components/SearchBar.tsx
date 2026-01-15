'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  initialValue: string;
  onSearch: (value: string) => void;
  isPending?: boolean;
  placeholder?: string;
}

export function SearchBar({
  initialValue,
  onSearch,
  isPending = false,
  placeholder = 'Search companies by name...',
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  // Track focus state to prevent prop sync while user is typing
  const isFocusedRef = useRef(false);

  // Sync internal value when initialValue changes (but not while focused)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);
      // Call parent immediately - hook handles debouncing
      onSearch(newValue);
    },
    [onSearch]
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
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => { isFocusedRef.current = false; }}
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
