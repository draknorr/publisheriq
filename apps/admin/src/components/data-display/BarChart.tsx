'use client';

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';

interface DataPoint {
  [key: string]: string | number;
}

// Chart color type
type ChartColor = 'coral' | 'green' | 'amber' | 'teal' | 'purple' | 'pink' | 'blue' | 'red' | 'cyan' | 'orange';

interface BarChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: ChartColor;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  horizontal?: boolean;
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  className?: string;
}

// Light theme colors
const lightColors: Record<string, string> = {
  coral: '#D4716A',
  green: '#2D8A6E',
  amber: '#D97706',
  teal: '#0E7490',
  purple: '#7C3AED',
  pink: '#EC4899',
  // Legacy aliases
  blue: '#0E7490',
  red: '#9C4338',
  cyan: '#D4716A',
  orange: '#D97706',
};

// Dark theme colors
const darkColors: Record<string, string> = {
  coral: '#E07D75',
  green: '#5DD4A8',
  amber: '#FBBF24',
  teal: '#38BDF8',
  purple: '#A78BFA',
  pink: '#F472B6',
  // Legacy aliases
  blue: '#38BDF8',
  red: '#CF7F76',
  cyan: '#E07D75',
  orange: '#FBBF24',
};

// Theme-aware chart styling
const lightTheme = {
  grid: '#E8E4DE',
  tick: '#7A756D',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E8E4DE',
  tooltipLabel: '#5C5752',
  tooltipText: '#2D2A26',
  positive: '#2D8A6E',
  negative: '#B54D42',
};

const darkTheme = {
  grid: '#332F2A',
  tick: '#8A847A',
  tooltipBg: '#211F1C',
  tooltipBorder: '#3D3935',
  tooltipLabel: '#B5B0A8',
  tooltipText: '#E8E4DE',
  positive: '#5DD4A8',
  negative: '#CF7F76',
};

export function BarChartComponent({
  data,
  xKey,
  yKey,
  height = 200,
  color = 'coral',
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  horizontal = false,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  className = '',
}: BarChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const theme = isDark ? darkTheme : lightTheme;

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-raised border border-border-subtle rounded-lg ${className}`}
        style={{ height }}
      >
        <span className="text-text-muted text-body-sm">No data available</span>
      </div>
    );
  }

  const fill = colors[color] || colors.coral;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.grid}
              horizontal={!horizontal}
              vertical={horizontal}
            />
          )}
          {horizontal ? (
            <>
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.tick, fontSize: 11 }}
                tickFormatter={formatYAxis}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.tick, fontSize: 11 }}
                tickFormatter={formatXAxis}
                width={80}
              />
            </>
          ) : (
            <>
              {showXAxis && (
                <XAxis
                  dataKey={xKey}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.tick, fontSize: 11 }}
                  tickFormatter={formatXAxis}
                  dy={8}
                />
              )}
              {showYAxis && (
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.tick, fontSize: 11 }}
                  tickFormatter={formatYAxis}
                  width={50}
                />
              )}
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: theme.tooltipBg,
              border: `1px solid ${theme.tooltipBorder}`,
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: theme.tooltipLabel, marginBottom: '4px' }}
            itemStyle={{ color: theme.tooltipText }}
            formatter={(value: number | undefined) => {
              if (value === undefined) return ['—', ''];
              return [
                formatTooltip ? formatTooltip(value) : value.toLocaleString(),
                '',
              ];
            }}
            cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
          />
          <Bar
            dataKey={yKey}
            fill={fill}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Custom tooltip for stacked bar chart - shows Positive before Negative with clean styling
interface StackedTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function StackedTooltip({ active, payload, label }: StackedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Sort to ensure Positive comes before Negative
  const sortedPayload = [...payload].sort((a, b) => {
    if (a.name === 'Positive') return -1;
    if (b.name === 'Positive') return 1;
    return 0;
  });

  return (
    <div className="bg-surface-overlay border border-border-subtle rounded-lg px-3 py-2 shadow-lg">
      <p className="text-caption text-text-secondary mb-1.5">{label}</p>
      {sortedPayload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-body-sm">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className={entry.name === 'Positive' ? 'text-accent-green' : 'text-accent-red'}>
            {entry.name}
          </span>
          <span className="text-text-primary font-medium">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// Stacked bar chart for positive/negative reviews
interface StackedBarChartProps {
  data: DataPoint[];
  xKey: string;
  positiveKey: string;
  negativeKey: string;
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  className?: string;
}

export function StackedBarChart({
  data,
  xKey,
  positiveKey,
  negativeKey,
  height = 200,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  formatXAxis,
  formatYAxis,
  className = '',
}: StackedBarChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-raised border border-border-subtle rounded-lg ${className}`}
        style={{ height }}
      >
        <span className="text-text-muted text-body-sm">No data available</span>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.grid}
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.tick, fontSize: 11 }}
              tickFormatter={formatXAxis}
              dy={8}
            />
          )}
          {showYAxis && (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.tick, fontSize: 11 }}
              tickFormatter={formatYAxis}
              width={50}
            />
          )}
          <Tooltip
            content={<StackedTooltip />}
            cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
          />
          <Bar
            dataKey={positiveKey}
            stackId="stack"
            fill={theme.positive}
            radius={[0, 0, 0, 0]}
            name="Positive"
          />
          <Bar
            dataKey={negativeKey}
            stackId="stack"
            fill={theme.negative}
            radius={[4, 4, 0, 0]}
            name="Negative"
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Ratio bar (horizontal inline bar showing positive/negative split)
interface RatioBarProps {
  positive: number;
  negative: number;
  height?: number;
  className?: string;
}

export function RatioBar({
  positive,
  negative,
  height = 8,
  className = '',
}: RatioBarProps) {
  const total = positive + negative;
  if (total === 0) {
    return (
      <div
        className={`w-full bg-surface-overlay rounded-full ${className}`}
        style={{ height }}
      />
    );
  }

  const positivePercent = (positive / total) * 100;

  return (
    <div
      className={`w-full flex rounded-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="bg-accent-green transition-all duration-300"
        style={{ width: `${positivePercent}%` }}
      />
      <div
        className="bg-accent-red transition-all duration-300"
        style={{ width: `${100 - positivePercent}%` }}
      />
    </div>
  );
}
