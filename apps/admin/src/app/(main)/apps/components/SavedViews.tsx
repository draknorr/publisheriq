'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Bookmark, Trash2, Edit2, Check, X, Plus } from 'lucide-react';
import type { SavedView } from '../hooks/useSavedViews';

interface SavedViewsProps {
  views: SavedView[];
  isLoaded: boolean;
  onSave: (name: string) => void;
  onLoad: (view: SavedView) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  disabled?: boolean;
}

/**
 * Saved views dropdown component
 */
export function SavedViews({
  views,
  isLoaded,
  onSave,
  onLoad,
  onDelete,
  onRename,
  disabled = false,
}: SavedViewsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!newName.trim()) return;
    onSave(newName.trim());
    setNewName('');
  }, [newName, onSave]);

  const handleStartEdit = useCallback((view: SavedView) => {
    setEditingId(view.id);
    setEditName(view.name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  }, [editingId, editName, onRename]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  // Don't render until loaded (prevents hydration mismatch)
  if (!isLoaded) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-body-sm transition-colors ${
          isOpen
            ? 'bg-accent-primary/10 text-accent-primary'
            : 'bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-muted hover:border-border-prominent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Bookmark className="h-4 w-4" />
        <span>Views</span>
        {views.length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary text-caption">
            {views.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 w-72 bg-surface-raised border border-border-muted rounded-lg shadow-lg overflow-hidden">
          {/* Create new view */}
          <div className="p-3 border-b border-border-subtle">
            <label className="text-caption font-medium text-text-secondary mb-1.5 block">
              Save current view
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="View name..."
                className="flex-1 h-8 px-2.5 rounded bg-surface-elevated border border-border-muted text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!newName.trim() || views.length >= 10}
                className="h-8 px-3 rounded bg-accent-primary text-white text-body-sm font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
            {views.length >= 10 && (
              <p className="text-caption text-accent-red mt-1">Maximum 10 views reached</p>
            )}
          </div>

          {/* Saved views list */}
          {views.length === 0 ? (
            <div className="p-4 text-center text-body-sm text-text-muted">
              No saved views yet
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {views.map((view) => (
                <div
                  key={view.id}
                  className="px-3 py-2 flex items-center justify-between hover:bg-surface-elevated group"
                >
                  {editingId === view.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-7 px-2 rounded bg-surface-elevated border border-accent-primary text-body-sm text-text-primary focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="p-1 rounded hover:bg-accent-primary/10 text-accent-primary"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 rounded hover:bg-accent-red/10 text-accent-red"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onLoad(view);
                          setIsOpen(false);
                        }}
                        className="flex-1 text-left text-body-sm text-text-primary hover:text-accent-primary truncate"
                      >
                        {view.name}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(view)}
                          className="p-1 rounded hover:bg-surface-overlay text-text-muted hover:text-text-secondary"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(view.id)}
                          className="p-1 rounded hover:bg-accent-red/10 text-text-muted hover:text-accent-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
