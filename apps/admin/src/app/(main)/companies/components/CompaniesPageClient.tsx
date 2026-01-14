'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { CompanyTypeToggle } from './CompanyTypeToggle';
import { CompaniesTable } from './CompaniesTable';
import type { Company, CompanyType, SortField, SortOrder } from '../lib/companies-types';

interface CompaniesPageClientProps {
  initialData: Company[];
  initialType: CompanyType;
  initialSort: SortField;
  initialOrder: SortOrder;
}

export function CompaniesPageClient({
  initialData,
  initialType,
  initialSort,
  initialOrder,
}: CompaniesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateUrl = (updates: Partial<{ type: string; sort: string; order: string }>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    startTransition(() => {
      router.push(`/companies?${params.toString()}`);
    });
  };

  const handleTypeChange = (type: CompanyType) => {
    updateUrl({ type });
  };

  const handleSort = (field: SortField) => {
    // Toggle order if same field, otherwise use desc
    const newOrder = initialSort === field && initialOrder === 'desc' ? 'asc' : 'desc';
    updateUrl({ sort: field, order: newOrder });
  };

  return (
    <div className={`space-y-6 ${isPending ? 'opacity-60' : ''}`}>
      {/* Type Toggle */}
      <CompanyTypeToggle
        value={initialType}
        onChange={handleTypeChange}
        disabled={isPending}
      />

      {/* Companies Table */}
      <CompaniesTable
        companies={initialData}
        sortField={initialSort}
        sortOrder={initialOrder}
        onSort={handleSort}
      />
    </div>
  );
}
