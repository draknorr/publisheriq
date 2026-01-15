'use client';

import { useState, useCallback, useRef } from 'react';
import type { Company, CompanyIdentifier } from '../lib/companies-types';
import { serializeCompanyId, parseSerializedCompanyId } from '../lib/companies-types';

const MAX_SELECTION = 50; // Maximum items that can be selected (for export limits)

interface UseCompaniesSelectionReturn {
  /** Set of selected company IDs in "pub:123" or "dev:456" format */
  selectedIds: Set<string>;
  /** Number of selected companies */
  selectedCount: number;
  /** Check if a specific company is selected */
  isSelected: (id: number, type: 'publisher' | 'developer') => boolean;
  /** Whether all visible companies are selected */
  isAllVisibleSelected: (visibleCompanies: Company[]) => boolean;
  /** Whether some but not all visible companies are selected */
  isIndeterminate: (visibleCompanies: Company[]) => boolean;
  /** Toggle selection for a single company (supports shift-click for range) */
  toggleSelection: (
    id: number,
    type: 'publisher' | 'developer',
    index: number,
    visibleCompanies: Company[],
    shiftKey?: boolean
  ) => void;
  /** Toggle selection for all visible companies */
  toggleAllVisible: (visibleCompanies: Company[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Get selected companies from the visible list */
  getSelectedCompanies: (allCompanies: Company[]) => Company[];
  /** Get selected identifiers */
  getSelectedIdentifiers: () => CompanyIdentifier[];
}

/**
 * Hook for managing ephemeral company selection state
 * Selection is NOT persisted to URL (too volatile)
 */
export function useCompaniesSelection(): UseCompaniesSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);

  const isSelected = useCallback(
    (id: number, type: 'publisher' | 'developer'): boolean => {
      return selectedIds.has(serializeCompanyId(id, type));
    },
    [selectedIds]
  );

  const isAllVisibleSelected = useCallback(
    (visibleCompanies: Company[]): boolean => {
      if (visibleCompanies.length === 0) return false;
      return visibleCompanies.every((company) =>
        selectedIds.has(serializeCompanyId(company.id, company.type))
      );
    },
    [selectedIds]
  );

  const isIndeterminate = useCallback(
    (visibleCompanies: Company[]): boolean => {
      if (visibleCompanies.length === 0) return false;
      const selectedInVisible = visibleCompanies.filter((company) =>
        selectedIds.has(serializeCompanyId(company.id, company.type))
      ).length;
      return selectedInVisible > 0 && selectedInVisible < visibleCompanies.length;
    },
    [selectedIds]
  );

  const toggleSelection = useCallback(
    (
      id: number,
      type: 'publisher' | 'developer',
      index: number,
      visibleCompanies: Company[],
      shiftKey: boolean = false
    ) => {
      const serialized = serializeCompanyId(id, type);

      setSelectedIds((prev) => {
        const next = new Set(prev);

        // Shift-click range selection
        if (shiftKey && lastSelectedIndexRef.current !== null) {
          const start = Math.min(lastSelectedIndexRef.current, index);
          const end = Math.max(lastSelectedIndexRef.current, index);

          for (let i = start; i <= end; i++) {
            const company = visibleCompanies[i];
            if (company && next.size < MAX_SELECTION) {
              next.add(serializeCompanyId(company.id, company.type));
            }
          }
        } else {
          // Single click toggle
          if (next.has(serialized)) {
            next.delete(serialized);
          } else if (next.size < MAX_SELECTION) {
            next.add(serialized);
          }
        }

        return next;
      });

      lastSelectedIndexRef.current = index;
    },
    []
  );

  const toggleAllVisible = useCallback((visibleCompanies: Company[]) => {
    setSelectedIds((prev) => {
      const allSelected = visibleCompanies.every((company) =>
        prev.has(serializeCompanyId(company.id, company.type))
      );

      if (allSelected) {
        // Deselect all visible
        const next = new Set(prev);
        visibleCompanies.forEach((company) => {
          next.delete(serializeCompanyId(company.id, company.type));
        });
        return next;
      } else {
        // Select all visible (up to max)
        const next = new Set(prev);
        for (const company of visibleCompanies) {
          if (next.size >= MAX_SELECTION) break;
          next.add(serializeCompanyId(company.id, company.type));
        }
        return next;
      }
    });

    lastSelectedIndexRef.current = null;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  const getSelectedCompanies = useCallback(
    (allCompanies: Company[]): Company[] => {
      return allCompanies.filter((company) =>
        selectedIds.has(serializeCompanyId(company.id, company.type))
      );
    },
    [selectedIds]
  );

  const getSelectedIdentifiers = useCallback((): CompanyIdentifier[] => {
    const identifiers: CompanyIdentifier[] = [];
    selectedIds.forEach((serialized) => {
      const parsed = parseSerializedCompanyId(serialized);
      if (parsed) {
        identifiers.push(parsed);
      }
    });
    return identifiers;
  }, [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    isAllVisibleSelected,
    isIndeterminate,
    toggleSelection,
    toggleAllVisible,
    clearSelection,
    getSelectedCompanies,
    getSelectedIdentifiers,
  };
}
