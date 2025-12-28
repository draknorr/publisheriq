'use client';

import { ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';

interface SparklineProps {
  data: number[];
  height?: number;
  width?: number;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'orange';
  variant?: 'area' | 'line';
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

export function Sparkline({
  data,
  height = 32,
  width,
  color = 'blue',
  variant = 'area',
  className = '',
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <span className="text-text-muted text-caption">—</span>
      </div>
    );
  }

  const chartData = data.map((value, index) => ({ value, index }));
  const { stroke, fill } = colorMap[color];

  if (variant === 'line') {
    return (
      <div className={className} style={{ height, width }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className} style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fill} stopOpacity={0.3} />
              <stop offset="100%" stopColor={fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#gradient-${color})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Trend-aware sparkline that changes color based on direction
interface TrendSparklineProps extends Omit<SparklineProps, 'color'> {
  trend?: 'up' | 'down' | 'stable';
}

export function TrendSparkline({
  trend = 'stable',
  ...props
}: TrendSparklineProps) {
  const color = trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'blue';
  return <Sparkline {...props} color={color} />;
}
