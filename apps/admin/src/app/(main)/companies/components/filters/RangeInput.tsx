'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/Input';

interface RangeInputProps {
  label: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  /** Format value for display (e.g., "1M" for 1000000) */
  formatDisplay?: (value: number) => string;
  /** Parse user input to number (e.g., handle "1M" → 1000000) */
  parseInput?: (value: string) => number | undefined;
  disabled?: boolean;
  /** Optional suffix to display (e.g., "%") */
  suffix?: string;
  /** Type of input - number or text for formatted input */
  inputType?: 'number' | 'text';
}

/**
 * Reusable min/max range input component
 * Updates parent immediately - debouncing is handled by useCompaniesFilters hook
 */
export function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder = 'Min',
  maxPlaceholder = 'Max',
  // formatDisplay reserved for future formatted input display
  parseInput,
  disabled = false,
  suffix,
  inputType = 'number',
}: RangeInputProps) {
  // Local state for immediate UI feedback
  const [localMin, setLocalMin] = useState<string>(
    minValue !== undefined ? String(minValue) : ''
  );
  const [localMax, setLocalMax] = useState<string>(
    maxValue !== undefined ? String(maxValue) : ''
  );

  // Track focus state to prevent prop sync while user is typing
  const minFocusedRef = useRef(false);
  const maxFocusedRef = useRef(false);

  // Sync local state when external value changes (but not while focused)
  useEffect(() => {
    if (!minFocusedRef.current) {
      setLocalMin(minValue !== undefined ? String(minValue) : '');
    }
  }, [minValue]);

  useEffect(() => {
    if (!maxFocusedRef.current) {
      setLocalMax(maxValue !== undefined ? String(maxValue) : '');
    }
  }, [maxValue]);

  const parseValue = useCallback(
    (value: string): number | undefined => {
      if (!value.trim()) return undefined;
      if (parseInput) return parseInput(value);
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    },
    [parseInput]
  );

  const handleMinChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMin(value);
      // Call parent immediately - hook handles debouncing
      onMinChange(parseValue(value));
    },
    [onMinChange, parseValue]
  );

  const handleMaxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMax(value);
      // Call parent immediately - hook handles debouncing
      onMaxChange(parseValue(value));
    },
    [onMaxChange, parseValue]
  );

  return (
    <div className="space-y-1.5">
      <label className="block text-body-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            type={inputType}
            value={localMin}
            onChange={handleMinChange}
            onFocus={() => { minFocusedRef.current = true; }}
            onBlur={() => { minFocusedRef.current = false; }}
            placeholder={minPlaceholder}
            disabled={disabled}
            className="h-8 text-body-sm"
          />
        </div>
        <span className="text-text-muted text-body-sm">–</span>
        <div className="flex-1">
          <Input
            type={inputType}
            value={localMax}
            onChange={handleMaxChange}
            onFocus={() => { maxFocusedRef.current = true; }}
            onBlur={() => { maxFocusedRef.current = false; }}
            placeholder={maxPlaceholder}
            disabled={disabled}
            className="h-8 text-body-sm"
          />
        </div>
        {suffix && (
          <span className="text-text-muted text-body-sm min-w-[20px]">{suffix}</span>
        )}
      </div>
    </div>
  );
}
