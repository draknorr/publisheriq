'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

interface DualRangeSliderProps {
  label: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  absoluteMin: number;
  absoluteMax: number;
  scale?: 'linear' | 'log';
  /** Format value for display (e.g., "1.2M", "$5M") */
  formatValue: (value: number) => string;
  /** Parse user input to number (e.g., "1M" -> 1000000) */
  parseInput?: (value: string) => number | undefined;
  /** Show match count when available */
  matchCount?: number;
  matchCountLoading?: boolean;
  disabled?: boolean;
  /** Suffix for input display (e.g., "%") */
  suffix?: string;
  /** Prefix for input display (e.g., "$") */
  prefix?: string;
}

// Scale conversion functions
function linearToLog(position: number, min: number, max: number): number {
  if (position <= 0) return min;
  if (position >= 1) return max;
  const safeMin = Math.max(min, 1);
  const logMin = Math.log10(safeMin);
  const logMax = Math.log10(max);
  return Math.pow(10, logMin + position * (logMax - logMin));
}

function logToLinear(value: number, min: number, max: number): number {
  const safeMin = Math.max(min, 1);
  const safeValue = Math.max(value, safeMin);
  const logMin = Math.log10(safeMin);
  const logMax = Math.log10(max);
  const logValue = Math.log10(safeValue);
  return (logValue - logMin) / (logMax - logMin);
}

function positionToValue(
  position: number,
  min: number,
  max: number,
  scale: 'linear' | 'log'
): number {
  if (scale === 'linear') {
    return min + position * (max - min);
  }
  return linearToLog(position, min, max);
}

function valueToPosition(
  value: number,
  min: number,
  max: number,
  scale: 'linear' | 'log'
): number {
  if (scale === 'linear') {
    return (value - min) / (max - min);
  }
  return logToLinear(value, min, max);
}

// Smart value parser that handles suffixes like "1M", "1K", "1B"
function parseSmartValue(input: string): number | undefined {
  if (!input.trim()) return undefined;

  // Remove currency symbols and commas
  const cleaned = input.replace(/[$,]/g, '').trim().toLowerCase();

  // Check for suffix multipliers
  const suffixMatch = cleaned.match(/^([\d.]+)\s*([kmb%]?)$/);
  if (!suffixMatch) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  const [, numStr, suffix] = suffixMatch;
  const num = parseFloat(numStr);
  if (isNaN(num)) return undefined;

  switch (suffix) {
    case 'k': return num * 1_000;
    case 'm': return num * 1_000_000;
    case 'b': return num * 1_000_000_000;
    case '%': return num; // Percentage - keep as is
    default: return num;
  }
}

export function DualRangeSlider({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  absoluteMin,
  absoluteMax,
  scale = 'log',
  formatValue,
  parseInput,
  matchCount,
  matchCountLoading,
  disabled = false,
  suffix,
  prefix,
}: DualRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  // Local state for text inputs (immediate feedback while typing)
  const [localMin, setLocalMin] = useState<string>('');
  const [localMax, setLocalMax] = useState<string>('');
  const minInputFocused = useRef(false);
  const maxInputFocused = useRef(false);

  // Pending values during drag - only committed on pointer up
  const pendingMinRef = useRef<number | undefined>(undefined);
  const pendingMaxRef = useRef<number | undefined>(undefined);

  // Local position state for smooth visual updates during drag
  const [dragMinPosition, setDragMinPosition] = useState<number | null>(null);
  const [dragMaxPosition, setDragMaxPosition] = useState<number | null>(null);

  // Parse input using custom parser or smart default
  const parseValue = useCallback(
    (value: string): number | undefined => {
      if (parseInput) return parseInput(value);
      return parseSmartValue(value);
    },
    [parseInput]
  );

  // Sync local state from props (when not focused)
  useEffect(() => {
    if (!minInputFocused.current) {
      setLocalMin(minValue !== undefined ? formatValue(minValue) : '');
    }
  }, [minValue, formatValue]);

  useEffect(() => {
    if (!maxInputFocused.current) {
      setLocalMax(maxValue !== undefined ? formatValue(maxValue) : '');
    }
  }, [maxValue, formatValue]);

  // Calculate thumb positions - use drag position during drag for smooth visuals
  const minPosition = dragMinPosition !== null
    ? dragMinPosition
    : (minValue !== undefined ? valueToPosition(minValue, absoluteMin, absoluteMax, scale) : 0);
  const maxPosition = dragMaxPosition !== null
    ? dragMaxPosition
    : (maxValue !== undefined ? valueToPosition(maxValue, absoluteMin, absoluteMax, scale) : 1);

  // Handle text input changes
  const handleMinInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalMin(raw);
      const parsed = parseValue(raw);
      // Clamp to valid range and ensure min <= max
      if (parsed !== undefined) {
        const clamped = Math.max(absoluteMin, Math.min(absoluteMax, parsed));
        if (maxValue === undefined || clamped <= maxValue) {
          onMinChange(clamped);
        }
      } else if (raw === '') {
        onMinChange(undefined);
      }
    },
    [parseValue, absoluteMin, absoluteMax, maxValue, onMinChange]
  );

  const handleMaxInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalMax(raw);
      const parsed = parseValue(raw);
      if (parsed !== undefined) {
        const clamped = Math.max(absoluteMin, Math.min(absoluteMax, parsed));
        if (minValue === undefined || clamped >= minValue) {
          onMaxChange(clamped);
        }
      } else if (raw === '') {
        onMaxChange(undefined);
      }
    },
    [parseValue, absoluteMin, absoluteMax, minValue, onMaxChange]
  );

  // Pointer event handlers for thumb dragging
  const handlePointerDown = useCallback(
    (thumb: 'min' | 'max') => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(thumb);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging || !trackRef.current || disabled) return;

      const rect = trackRef.current.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const value = Math.round(positionToValue(position, absoluteMin, absoluteMax, scale));

      if (dragging === 'min') {
        // Constrain min to not exceed max
        const currentMaxPos = dragMaxPosition ?? (maxValue !== undefined ? valueToPosition(maxValue, absoluteMin, absoluteMax, scale) : 1);
        if (position <= currentMaxPos) {
          // Visual update only - don't call parent during drag
          setLocalMin(formatValue(value));
          setDragMinPosition(position);
          pendingMinRef.current = value;
        }
      } else {
        // Constrain max to not go below min
        const currentMinPos = dragMinPosition ?? (minValue !== undefined ? valueToPosition(minValue, absoluteMin, absoluteMax, scale) : 0);
        if (position >= currentMinPos) {
          // Visual update only - don't call parent during drag
          setLocalMax(formatValue(value));
          setDragMaxPosition(position);
          pendingMaxRef.current = value;
        }
      }
    },
    [dragging, disabled, absoluteMin, absoluteMax, scale, minValue, maxValue, formatValue, dragMinPosition, dragMaxPosition]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);

      // Commit pending values to parent on drag end
      if (dragging === 'min' && pendingMinRef.current !== undefined) {
        onMinChange(pendingMinRef.current);
        pendingMinRef.current = undefined;
        setDragMinPosition(null);
      } else if (dragging === 'max' && pendingMaxRef.current !== undefined) {
        onMaxChange(pendingMaxRef.current);
        pendingMaxRef.current = undefined;
        setDragMaxPosition(null);
      }

      setDragging(null);
    },
    [dragging, onMinChange, onMaxChange]
  );

  // Handle track click to move nearest thumb
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const value = Math.round(positionToValue(position, absoluteMin, absoluteMax, scale));

      // Determine which thumb is closer
      const minDist = Math.abs(position - minPosition);
      const maxDist = Math.abs(position - maxPosition);

      if (minDist <= maxDist) {
        const constrainedMax = maxValue ?? absoluteMax;
        if (value <= constrainedMax) {
          onMinChange(value);
        }
      } else {
        const constrainedMin = minValue ?? absoluteMin;
        if (value >= constrainedMin) {
          onMaxChange(value);
        }
      }
    },
    [disabled, absoluteMin, absoluteMax, scale, minPosition, maxPosition, minValue, maxValue, onMinChange, onMaxChange]
  );

  const inputBaseClasses = `
    w-20 h-7 px-2 rounded
    bg-surface-elevated border border-border-muted
    text-body-sm text-text-primary text-center
    placeholder:text-text-muted
    transition-colors duration-150
    hover:border-border-prominent
    focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  return (
    <div className="space-y-2">
      {/* Label row with match count */}
      <div className="flex items-center justify-between">
        <label className="text-body-sm font-medium text-text-secondary">
          {label}
        </label>
        {(matchCount !== undefined || matchCountLoading) && (
          <span className="text-caption text-text-muted">
            {matchCountLoading ? (
              <span className="inline-block w-16 h-3 bg-surface-overlay rounded animate-pulse" />
            ) : (
              `(${matchCount?.toLocaleString()} matches)`
            )}
          </span>
        )}
      </div>

      {/* Slider with inputs */}
      <div className="flex items-center gap-3">
        {/* Min input */}
        <div className="relative">
          {prefix && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
              {prefix}
            </span>
          )}
          <input
            type="text"
            value={localMin}
            onChange={handleMinInputChange}
            onFocus={() => { minInputFocused.current = true; }}
            onBlur={() => {
              minInputFocused.current = false;
              // Sync display on blur
              setLocalMin(minValue !== undefined ? formatValue(minValue) : '');
            }}
            placeholder={formatValue(absoluteMin)}
            disabled={disabled}
            className={`${inputBaseClasses} ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-5' : ''}`}
          />
          {suffix && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
              {suffix}
            </span>
          )}
        </div>

        {/* Track with thumbs */}
        <div
          ref={trackRef}
          className={`
            relative flex-1 h-2 rounded-full cursor-pointer
            bg-surface-overlay
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={handleTrackClick}
        >
          {/* Active range highlight */}
          <div
            className="absolute top-0 h-full bg-accent-primary/40 rounded-full"
            style={{
              left: `${minPosition * 100}%`,
              width: `${(maxPosition - minPosition) * 100}%`,
            }}
          />

          {/* Min thumb */}
          <div
            className={`
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              w-4 h-4 rounded-full
              bg-surface border-2 border-accent-primary
              shadow-sm cursor-grab
              transition-transform duration-100
              hover:scale-110
              ${dragging === 'min' ? 'scale-110 cursor-grabbing' : ''}
              ${disabled ? 'cursor-not-allowed' : ''}
            `}
            style={{ left: `${minPosition * 100}%` }}
            onPointerDown={handlePointerDown('min')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Max thumb */}
          <div
            className={`
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              w-4 h-4 rounded-full
              bg-surface border-2 border-accent-primary
              shadow-sm cursor-grab
              transition-transform duration-100
              hover:scale-110
              ${dragging === 'max' ? 'scale-110 cursor-grabbing' : ''}
              ${disabled ? 'cursor-not-allowed' : ''}
            `}
            style={{ left: `${maxPosition * 100}%` }}
            onPointerDown={handlePointerDown('max')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {/* Max input */}
        <div className="relative">
          {prefix && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
              {prefix}
            </span>
          )}
          <input
            type="text"
            value={localMax}
            onChange={handleMaxInputChange}
            onFocus={() => { maxInputFocused.current = true; }}
            onBlur={() => {
              maxInputFocused.current = false;
              setLocalMax(maxValue !== undefined ? formatValue(maxValue) : '');
            }}
            placeholder={formatValue(absoluteMax)}
            disabled={disabled}
            className={`${inputBaseClasses} ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-5' : ''}`}
          />
          {suffix && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
              {suffix}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
