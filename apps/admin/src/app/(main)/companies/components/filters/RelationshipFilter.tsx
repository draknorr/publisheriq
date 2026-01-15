'use client';

import type { RelationshipFilterValue, CompanyType } from '../../lib/companies-types';

interface RelationshipFilterProps {
  value: RelationshipFilterValue;
  companyType: CompanyType;
  onChange: (value: RelationshipFilterValue) => void;
  disabled?: boolean;
}

interface FilterOption {
  id: RelationshipFilterValue;
  label: string;
  description: string;
  showFor: CompanyType[];
}

const ALL_OPTIONS: FilterOption[] = [
  {
    id: null,
    label: 'Any',
    description: 'No relationship filter',
    showFor: ['all', 'publisher', 'developer'],
  },
  {
    id: 'self_published',
    label: 'Self-Published',
    description: 'Publisher name matches developer name on all games',
    showFor: ['all', 'publisher', 'developer'],
  },
  {
    id: 'external_devs',
    label: 'External Devs',
    description: 'Works with third-party developers',
    showFor: ['all', 'publisher'],
  },
  {
    id: 'multi_publisher',
    label: 'Multi-Publisher',
    description: 'Works with multiple different publishers',
    showFor: ['all', 'developer'],
  },
];

/**
 * Radio buttons for filtering by relationship type
 */
export function RelationshipFilter({
  value,
  companyType,
  onChange,
  disabled = false,
}: RelationshipFilterProps) {
  // Filter options based on company type
  const visibleOptions = ALL_OPTIONS.filter((opt) => opt.showFor.includes(companyType));

  return (
    <div className="space-y-2">
      <label className="block text-body-sm font-medium text-text-secondary">Relationship</label>
      <div className="flex flex-wrap gap-2">
        {visibleOptions.map((option) => (
          <button
            key={option.id ?? 'any'}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            title={option.description}
            className={`px-3 py-1.5 rounded text-body-sm transition-colors ${
              value === option.id
                ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:border-border-prominent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
