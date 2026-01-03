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
              stroke="#36363e"
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
                tick={{ fill: '#8e8e96', fontSize: 11 }}
                tickFormatter={formatYAxis}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8e8e96', fontSize: 11 }}
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
                  tick={{ fill: '#8e8e96', fontSize: 11 }}
                  tickFormatter={formatXAxis}
                  dy={8}
                />
              )}
              {showYAxis && (
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8e8e96', fontSize: 11 }}
                  tickFormatter={formatYAxis}
                  width={50}
                />
              )}
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: '1px solid #36363e',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: '#b4b4bc', marginBottom: '4px' }}
            itemStyle={{ color: '#f4f4f5' }}
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
              stroke="#36363e"
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8e8e96', fontSize: 11 }}
              tickFormatter={formatXAxis}
              dy={8}
            />
          )}
          {showYAxis && (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8e8e96', fontSize: 11 }}
              tickFormatter={formatYAxis}
              width={50}
            />
          )}
          <Tooltip
            content={<StackedTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
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
