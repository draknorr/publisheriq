'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { CompanyType } from '../lib/companies-types';

interface CompanyTypeToggleProps {
  value: CompanyType;
  onChange: (type: CompanyType) => void;
  disabled?: boolean;
}

export function CompanyTypeToggle({
  value,
  onChange,
  disabled = false,
}: CompanyTypeToggleProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as CompanyType)}
      className="w-fit"
    >
      <TabsList>
        <TabsTrigger value="all" disabled={disabled}>
          All Companies
        </TabsTrigger>
        <TabsTrigger value="publisher" disabled={disabled}>
          Publishers
        </TabsTrigger>
        <TabsTrigger value="developer" disabled={disabled}>
          Developers
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
