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

interface DataPoint {
  [key: string]: string | number;
}

interface BarChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'orange';
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  horizontal?: boolean;
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  className?: string;
}

const colorMap = {
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
  orange: '#f97316',
};

export function BarChartComponent({
  data,
  xKey,
  yKey,
  height = 200,
  color = 'blue',
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  horizontal = false,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  className = '',
}: BarChartProps) {
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

  const fill = colorMap[color];

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
              stroke="#27272a"
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
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickFormatter={formatYAxis}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 11 }}
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
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={formatXAxis}
                  dy={8}
                />
              )}
              {showYAxis && (
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={formatYAxis}
                  width={50}
                />
              )}
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#111113',
              border: '1px solid #27272a',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
            itemStyle={{ color: '#fafafa' }}
            formatter={(value: number | undefined) => {
              if (value === undefined) return ['—', ''];
              return [
                formatTooltip ? formatTooltip(value) : value.toLocaleString(),
                '',
              ];
            }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
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
              stroke="#27272a"
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={formatXAxis}
              dy={8}
            />
          )}
          {showYAxis && (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={formatYAxis}
              width={50}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#111113',
              border: '1px solid #27272a',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
          />
          <Bar
            dataKey={positiveKey}
            stackId="stack"
            fill="#22c55e"
            radius={[0, 0, 0, 0]}
            name="Positive"
          />
          <Bar
            dataKey={negativeKey}
            stackId="stack"
            fill="#ef4444"
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
