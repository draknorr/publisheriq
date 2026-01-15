'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/Input';

const DEBOUNCE_MS = 300;

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
 * Reusable min/max range input component with debounced updates
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

  const minDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const maxDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when external value changes
  useEffect(() => {
    setLocalMin(minValue !== undefined ? String(minValue) : '');
  }, [minValue]);

  useEffect(() => {
    setLocalMax(maxValue !== undefined ? String(maxValue) : '');
  }, [maxValue]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (minDebounceRef.current) clearTimeout(minDebounceRef.current);
      if (maxDebounceRef.current) clearTimeout(maxDebounceRef.current);
    };
  }, []);

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

      if (minDebounceRef.current) {
        clearTimeout(minDebounceRef.current);
      }

      minDebounceRef.current = setTimeout(() => {
        onMinChange(parseValue(value));
      }, DEBOUNCE_MS);
    },
    [onMinChange, parseValue]
  );

  const handleMaxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalMax(value);

      if (maxDebounceRef.current) {
        clearTimeout(maxDebounceRef.current);
      }

      maxDebounceRef.current = setTimeout(() => {
        onMaxChange(parseValue(value));
      }, DEBOUNCE_MS);
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
