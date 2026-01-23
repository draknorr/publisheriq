/**
 * SentimentCell - Display sentiment delta with emoji/color thresholds
 *
 * Thresholds:
 * >= +10%: up double arrow + bright green (Surging)
 * +3% to +9%: up arrow + green (Improving)
 * -3% to +3%: right arrow + gray (Stable)
 * -9% to -3%: down arrow + orange (Declining)
 * <= -10%: down double arrow + red (Review Bomb)
 */

interface SentimentCellProps {
  value: number | null;
  showEmoji?: boolean;
}

interface SentimentConfig {
  icon: string;
  colorClass: string;
  prefix: string;
}

function getSentimentConfig(value: number): SentimentConfig {
  if (value >= 10) {
    return {
      icon: '\u21C8', // upwards paired arrows
      colorClass: 'text-semantic-success font-semibold',
      prefix: '+',
    };
  }
  if (value >= 3) {
    return {
      icon: '\u2191', // up arrow
      colorClass: 'text-trend-positive',
      prefix: '+',
    };
  }
  if (value > -3) {
    return {
      icon: '\u2192', // right arrow
      colorClass: 'text-text-tertiary',
      prefix: value > 0 ? '+' : '',
    };
  }
  if (value > -10) {
    return {
      icon: '\u2193', // down arrow
      colorClass: 'text-semantic-warning',
      prefix: '',
    };
  }
  return {
    icon: '\u21CA', // downwards paired arrows
    colorClass: 'text-trend-negative font-semibold',
    prefix: '',
  };
}

export function SentimentCell({ value, showEmoji = true }: SentimentCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const { icon, colorClass, prefix } = getSentimentConfig(value);
  const formattedValue = `${prefix}${Math.abs(value).toFixed(1)}%`;

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      {showEmoji && <span>{icon}</span>}
      <span>{formattedValue}</span>
    </span>
  );
}
