'use client';

import { Info } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { methodology } from '../lib/apps-methodology';

interface MethodologyTooltipProps {
  field: string;
}

export function MethodologyTooltip({ field }: MethodologyTooltipProps) {
  const content = methodology[field as keyof typeof methodology];
  if (!content) return null;

  return (
    <Popover
      trigger={
        <span className="inline-flex ml-1 text-text-muted hover:text-text-secondary cursor-help">
          <Info className="h-3.5 w-3.5" />
        </span>
      }
      content={
        <div className="max-w-xs p-3 text-body-sm text-text-secondary">
          {content}
        </div>
      }
      position="top"
      align="center"
    />
  );
}
