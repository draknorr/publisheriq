'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';

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
    <div className="mb-6 p-4 rounded-lg bg-surface-elevated border border-border-subtle">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-text-tertiary" />
        <span className="text-body-sm font-medium text-text-secondary">Advanced Filters</span>
      </div>
      <div className="flex flex-wrap gap-4">
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
    </div>
  );
}
