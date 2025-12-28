'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface TabsContextValue {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function Tabs({ children, value, onValueChange, className = '' }: TabsProps) {
  return (
    <TabsContext.Provider value={{ activeTab: value, onTabChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`
        inline-flex items-center gap-1 p-1
        bg-surface-elevated rounded-lg border border-border-subtle
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  children: ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({
  children,
  value,
  disabled = false,
  className = '',
}: TabsTriggerProps) {
  const { activeTab, onTabChange } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onTabChange(value)}
      className={`
        px-3 py-1.5 rounded-md text-body-sm font-medium
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          isActive
            ? 'bg-surface-raised text-text-primary shadow-subtle'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  children: ReactNode;
  value: string;
  className?: string;
}

export function TabsContent({ children, value, className = '' }: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}

// Underline variant tabs for different use case
interface UnderlineTabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function UnderlineTabs({
  tabs,
  activeTab,
  onChange,
  className = '',
}: UnderlineTabsProps) {
  return (
    <div className={`border-b border-border-subtle ${className}`}>
      <nav className="flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative py-3 text-body font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2
              ${
                activeTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }
            `}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`
                    px-1.5 py-0.5 rounded text-caption
                    ${
                      activeTab === tab.id
                        ? 'bg-accent-blue/15 text-accent-blue'
                        : 'bg-surface-overlay text-text-tertiary'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
