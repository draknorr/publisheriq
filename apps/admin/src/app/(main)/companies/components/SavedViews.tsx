'use client';

import { useState, useCallback } from 'react';
import { Bookmark, Plus, Trash2, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { useSavedViews } from '../hooks/useSavedViews';
import type { SavedView, CompanyType, SortField, SortOrder, ColumnId } from '../lib/companies-types';
import type { AdvancedFiltersState } from '../hooks/useCompaniesFilters';

interface SavedViewsProps {
  currentFilters: AdvancedFiltersState;
  currentSort: SortField;
  currentOrder: SortOrder;
  currentType: CompanyType;
  currentColumns: ColumnId[];
  onApplyView: (view: SavedView) => void;
  disabled?: boolean;
}

/**
 * Saved views dropdown with save, load, delete, and rename functionality
 */
export function SavedViews({
  currentFilters,
  currentSort,
  currentOrder,
  currentType,
  currentColumns,
  onApplyView,
  disabled = false,
}: SavedViewsProps) {
  const { views, isLoaded, saveView, deleteView, renameView } = useSavedViews();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = useCallback(() => {
    if (!newName.trim()) return;
    saveView(newName.trim(), currentFilters, currentColumns, currentSort, currentOrder, currentType);
    setNewName('');
    setIsCreating(false);
  }, [newName, currentFilters, currentColumns, currentSort, currentOrder, currentType, saveView]);

  const handleRename = useCallback(
    (id: string) => {
      if (!editName.trim()) return;
      renameView(id, editName.trim());
      setEditingId(null);
      setEditName('');
    },
    [editName, renameView]
  );

  const handleApply = useCallback(
    (view: SavedView) => {
      onApplyView(view);
      setIsOpen(false);
    },
    [onApplyView]
  );

  // Don't render until localStorage is loaded
  if (!isLoaded) return null;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-body-sm border transition-colors ${
          views.length > 0
            ? 'border-accent-primary/30 bg-accent-primary/5 text-accent-primary hover:bg-accent-primary/10'
            : 'border-border-subtle bg-surface-elevated text-text-secondary hover:border-border-prominent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Bookmark className="h-4 w-4" />
        <span>Saved Views</span>
        {views.length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-accent-primary/20 text-caption">
            {views.length}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-surface-raised border border-border-muted rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border-subtle bg-surface-elevated/50">
              <span className="text-body-sm font-medium text-text-primary">Saved Views</span>
            </div>

            {/* Views List */}
            <div className="max-h-64 overflow-y-auto">
              {views.length === 0 ? (
                <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                  No saved views yet
                </div>
              ) : (
                views.map((view) => (
                  <div
                    key={view.id}
                    className="group flex items-center justify-between px-3 py-2 hover:bg-surface-elevated transition-colors"
                  >
                    {editingId === view.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 h-7 text-body-sm rounded border border-border-muted bg-surface-base"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(view.id)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(view.id)}
                          className="p-1 text-accent-green hover:text-accent-green/80"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-text-muted hover:text-text-secondary"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApply(view)}
                          className="flex-1 text-left text-body-sm text-text-secondary hover:text-text-primary truncate"
                        >
                          {view.name}
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(view.id);
                              setEditName(view.name);
                            }}
                            className="p-1 text-text-muted hover:text-text-secondary"
                            title="Rename"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteView(view.id)}
                            className="p-1 text-text-muted hover:text-accent-red"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Save New View */}
            <div className="px-3 py-2 border-t border-border-subtle">
              {isCreating ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="View name..."
                    className="flex-1 px-2 py-1 h-7 text-body-sm rounded border border-border-muted bg-surface-base"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!newName.trim()}
                    className="p-1 text-accent-green hover:text-accent-green/80 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setNewName('');
                    }}
                    className="p-1 text-text-muted hover:text-text-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  disabled={disabled || views.length >= 10}
                  className="flex items-center gap-2 w-full text-body-sm text-accent-primary hover:text-accent-primary/80 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Save current view
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
