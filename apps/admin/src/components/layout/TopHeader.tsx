'use client';

import { Search, Menu, X } from 'lucide-react';
import { useSidebar } from '@/contexts';
import { useGlobalSearch } from '@/components/search';
import { ThemeToggle } from '@/components/ui';

export function TopHeader() {
  const { isOpen, toggle } = useSidebar();
  const { open: openSearch } = useGlobalSearch();

  return (
    <header
      className="
        sticky top-0 z-30
        h-14 flex items-center justify-between
        px-4 md:px-6 lg:px-8
        bg-surface/80 backdrop-blur-md
        border-b border-border-subtle
      "
    >
      {/* Left side: Mobile hamburger menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="
            md:hidden flex h-9 w-9 items-center justify-center
            rounded-lg bg-surface-raised border border-border-subtle
            hover:bg-surface-elevated transition-colors
          "
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-text-primary" />
          ) : (
            <Menu className="h-5 w-5 text-text-primary" />
          )}
        </button>
      </div>

      {/* Right side: Search + Mobile theme toggle */}
      <div className="flex items-center gap-3">
        {/* Desktop search trigger */}
        <button
          onClick={openSearch}
          className="
            hidden md:flex items-center gap-2.5
            h-9 px-4
            bg-surface-elevated border border-border-subtle rounded-lg
            text-text-muted hover:text-text-secondary hover:border-border-muted
            transition-all duration-150
          "
        >
          <Search className="w-4 h-4" />
          <span className="text-body-sm">Search...</span>
          <kbd className="ml-1 flex items-center gap-0.5 px-1.5 py-0.5 text-caption bg-surface rounded border border-border-subtle">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Mobile search icon */}
        <button
          onClick={openSearch}
          className="
            md:hidden flex h-9 w-9 items-center justify-center
            rounded-lg hover:bg-surface-elevated transition-colors
          "
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-text-primary" />
        </button>

        {/* Theme toggle - mobile only (desktop has it in sidebar footer) */}
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
