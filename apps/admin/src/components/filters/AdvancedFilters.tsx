'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  name: string;
  label: string;
  options: FilterOption[];
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  basePath: string;
}

export function AdvancedFilters({ filters, basePath }: AdvancedFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if any filters are active
  const activeFilterCount = filters.filter(
    (f) => searchParams.get(f.name) && searchParams.get(f.name) !== ''
  ).length;

  const handleChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="mb-6 rounded-lg bg-surface-elevated border border-border-subtle overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-surface-overlay/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-tertiary" />
          <span className="text-body-sm font-medium text-text-secondary">Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-caption font-medium bg-accent-blue/20 text-accent-blue">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 flex flex-wrap gap-4 border-t border-border-subtle pt-4">
          {filters.map((filter) => (
            <div key={filter.name} className="flex flex-col gap-1">
              <label className="text-caption text-text-tertiary">{filter.label}</label>
              <select
                value={searchParams.get(filter.name) ?? ''}
                onChange={(e) => handleChange(filter.name, e.target.value)}
                className="h-9 px-3 rounded-md bg-surface-raised border border-border-muted text-body-sm text-text-primary"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
