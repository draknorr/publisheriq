'use client';

import { ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';

// Color type includes new palette + legacy aliases
type SparklineColor =
  | 'coral' | 'green' | 'amber' | 'teal' | 'purple' | 'pink'  // New palette
  | 'success' | 'error'  // Semantic
  | 'blue' | 'red' | 'cyan' | 'orange';  // Legacy aliases

interface SparklineProps {
  data: number[];
  height?: number;
  width?: number;
  color?: SparklineColor;
  variant?: 'area' | 'line';
  className?: string;
}

// Light theme colors (Warm Stone + Dusty Coral)
const lightColors: Record<string, { stroke: string; fill: string }> = {
  // New palette (chart colors)
  coral: { stroke: '#D4716A', fill: '#D4716A' },
  green: { stroke: '#2D8A6E', fill: '#2D8A6E' },
  amber: { stroke: '#D97706', fill: '#D97706' },
  teal: { stroke: '#0E7490', fill: '#0E7490' },
  purple: { stroke: '#7C3AED', fill: '#7C3AED' },
  pink: { stroke: '#EC4899', fill: '#EC4899' },
  // Semantic
  success: { stroke: '#1E6B54', fill: '#1E6B54' },
  error: { stroke: '#9C4338', fill: '#9C4338' },
  // Legacy aliases
  blue: { stroke: '#0E7490', fill: '#0E7490' },
  red: { stroke: '#9C4338', fill: '#9C4338' },
  cyan: { stroke: '#D4716A', fill: '#D4716A' },
  orange: { stroke: '#D97706', fill: '#D97706' },
};

// Dark theme colors (brighter for visibility)
const darkColors: Record<string, { stroke: string; fill: string }> = {
  // New palette
  coral: { stroke: '#E07D75', fill: '#E07D75' },
  green: { stroke: '#5DD4A8', fill: '#5DD4A8' },
  amber: { stroke: '#FBBF24', fill: '#FBBF24' },
  teal: { stroke: '#38BDF8', fill: '#38BDF8' },
  purple: { stroke: '#A78BFA', fill: '#A78BFA' },
  pink: { stroke: '#F472B6', fill: '#F472B6' },
  // Semantic
  success: { stroke: '#5DD4A8', fill: '#5DD4A8' },
  error: { stroke: '#CF7F76', fill: '#CF7F76' },
  // Legacy aliases
  blue: { stroke: '#38BDF8', fill: '#38BDF8' },
  red: { stroke: '#CF7F76', fill: '#CF7F76' },
  cyan: { stroke: '#E07D75', fill: '#E07D75' },
  orange: { stroke: '#FBBF24', fill: '#FBBF24' },
};

export function Sparkline({
  data,
  height = 32,
  width,
  color = 'coral',
  variant = 'area',
  className = '',
}: SparklineProps) {
  const { resolvedTheme } = useTheme();

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
  const colorMap = resolvedTheme === 'dark' ? darkColors : lightColors;
  const { stroke, fill } = colorMap[color] || colorMap.coral;

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
  const color: SparklineColor = trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'coral';
  return <Sparkline {...props} color={color} />;
}
