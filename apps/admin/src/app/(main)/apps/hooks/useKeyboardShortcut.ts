'use client';

/**
 * Keyboard Shortcut Hook
 *
 * Global keyboard listener for ⌘K / Ctrl+K to open command palette.
 */

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutOptions {
  /** Key to listen for (default: 'k') */
  key?: string;
  /** Require Cmd/Ctrl modifier (default: true) */
  cmdOrCtrl?: boolean;
  /** Callback when shortcut is triggered */
  onTrigger: () => void;
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook for handling global keyboard shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   key: 'k',
 *   cmdOrCtrl: true,
 *   onTrigger: () => palette.toggle(),
 * });
 * ```
 */
export function useKeyboardShortcut({
  key = 'k',
  cmdOrCtrl = true,
  onTrigger,
  enabled = true,
}: UseKeyboardShortcutOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if the correct key is pressed
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      // Check modifier if required
      if (cmdOrCtrl) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const hasModifier = isMac ? event.metaKey : event.ctrlKey;
        if (!hasModifier) return;
      }

      // Allow ⌘K even in input fields (common pattern for command palettes)
      // The palette itself will handle focus management

      // Prevent default browser behavior (e.g., Safari's search)
      event.preventDefault();
      event.stopPropagation();

      // Trigger the callback
      onTrigger();
    },
    [key, cmdOrCtrl, onTrigger, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);
}

/**
 * Hook specifically for ⌘K / Ctrl+K command palette shortcut
 */
export function useCommandPaletteShortcut(
  onToggle: () => void,
  enabled = true
) {
  useKeyboardShortcut({
    key: 'k',
    cmdOrCtrl: true,
    onTrigger: onToggle,
    enabled,
  });
}
