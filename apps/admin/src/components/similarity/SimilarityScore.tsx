/**
 * Visual similarity score indicator
 * Displays a percentage score with color coding
 */

interface SimilarityScoreProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-accent-green bg-accent-green/15';
  if (score >= 60) return 'text-accent-cyan bg-accent-cyan/15';
  if (score >= 40) return 'text-accent-yellow bg-accent-yellow/15';
  return 'text-text-muted bg-surface-elevated';
}

const sizeStyles = {
  sm: 'text-caption px-1.5 py-0.5',
  md: 'text-body-sm px-2 py-0.5',
  lg: 'text-body px-2.5 py-1',
};

export function SimilarityScore({ score, size = 'md', className = '' }: SimilarityScoreProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded ${getScoreColor(score)} ${sizeStyles[size]} ${className}`}
      title={`${score}% similar`}
    >
      {score}%
    </span>
  );
}
