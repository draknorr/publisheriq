'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-body-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-9 rounded-md
              bg-surface-elevated border border-border-muted
              text-body text-text-primary placeholder:text-text-muted
              transition-colors duration-150
              hover:border-border-prominent
              focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-9' : 'pl-3'}
              ${rightIcon ? 'pr-9' : 'pr-3'}
              ${error ? 'border-accent-red focus:border-accent-red focus:ring-accent-red' : ''}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-body-sm text-accent-red">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Search input variant
interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
  value?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, className = '', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        leftIcon={<Search className="h-4 w-4" />}
        rightIcon={
          value && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="hover:text-text-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : undefined
        }
        value={value}
        className={`[&::-webkit-search-cancel-button]:hidden ${className}`}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
