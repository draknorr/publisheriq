'use client';

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface DataPoint {
  [key: string]: string | number;
}

interface AreaChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'orange';
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  className?: string;
}

const colorMap = {
  blue: { stroke: '#3b82f6', fill: '#3b82f6' },
  green: { stroke: '#22c55e', fill: '#22c55e' },
  red: { stroke: '#ef4444', fill: '#ef4444' },
  purple: { stroke: '#a855f7', fill: '#a855f7' },
  cyan: { stroke: '#06b6d4', fill: '#06b6d4' },
  orange: { stroke: '#f97316', fill: '#f97316' },
};

export function AreaChartComponent({
  data,
  xKey,
  yKey,
  height = 200,
  color = 'blue',
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  formatXAxis,
  formatYAxis,
  formatTooltip,
  className = '',
}: AreaChartProps) {
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

  const { stroke, fill } = colorMap[color];

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`areaGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fill} stopOpacity={0.2} />
              <stop offset="100%" stopColor={fill} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            itemStyle={{ color: '#fafafa' }}
            formatter={(value: number | undefined) => {
              if (value === undefined) return ['—', ''];
              return [
                formatTooltip ? formatTooltip(value) : value.toLocaleString(),
                '',
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#areaGradient-${color})`}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Multi-series area chart
interface MultiAreaChartProps {
  data: DataPoint[];
  xKey: string;
  series: { key: string; color: keyof typeof colorMap; label?: string }[];
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  stacked?: boolean;
  formatXAxis?: (value: string | number) => string;
  formatYAxis?: (value: number) => string;
  className?: string;
}

export function MultiAreaChart({
  data,
  xKey,
  series,
  height = 200,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  stacked = false,
  formatXAxis,
  formatYAxis,
  className = '',
}: MultiAreaChartProps) {
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
        <RechartsAreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`multiGradient-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={colorMap[s.color].fill}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={colorMap[s.color].fill}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
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
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label || s.key}
              stroke={colorMap[s.color].stroke}
              strokeWidth={2}
              fill={`url(#multiGradient-${s.key})`}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
