'use client';

import type { ChangeImpactMetricRow } from './lib';

interface ChangeImpactMetricTableProps {
  rows: ChangeImpactMetricRow[];
}

function deltaClassName(tone: ChangeImpactMetricRow['delta1d']['tone']): string {
  switch (tone) {
    case 'positive':
      return 'text-accent-green';
    case 'negative':
      return 'text-accent-red';
    default:
      return 'text-text-muted';
  }
}

export function ChangeImpactMetricTable({ rows }: ChangeImpactMetricTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-[11px] leading-5">
        <thead>
          <tr className="border-b border-border-subtle text-text-tertiary">
            <th className="px-3 py-2 text-left font-medium uppercase tracking-[0.08em]">Metric</th>
            <th className="px-3 py-2 text-right font-medium uppercase tracking-[0.08em]">Prior 7d</th>
            <th className="px-3 py-2 text-right font-medium uppercase tracking-[0.08em]">Post 1d</th>
            <th className="px-3 py-2 text-right font-medium uppercase tracking-[0.08em]">Delta 1d</th>
            <th className="px-3 py-2 text-right font-medium uppercase tracking-[0.08em]">Post 7d</th>
            <th className="px-3 py-2 text-right font-medium uppercase tracking-[0.08em]">Delta 7d</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border-subtle/70 last:border-0"
            >
              <th
                scope="row"
                className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-text-secondary"
              >
                {row.label}
              </th>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-text-primary">
                {row.pre7d}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-text-primary">
                {row.post1d}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-1.5 text-right font-mono ${deltaClassName(row.delta1d.tone)}`}
              >
                {row.delta1d.label}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-text-primary">
                {row.post7d}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-1.5 text-right font-mono ${deltaClassName(row.delta7d.tone)}`}
              >
                {row.delta7d.label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
