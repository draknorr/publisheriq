'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { AppType } from '../lib/apps-types';

interface AppTypeToggleProps {
  value: AppType;
  onChange: (type: AppType) => void;
  disabled?: boolean;
}

/**
 * Type toggle for filtering apps by type
 * Options: All Types, Games, DLC, Demos
 * Default: Games (type=game)
 */
export function AppTypeToggle({
  value,
  onChange,
  disabled = false,
}: AppTypeToggleProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as AppType)}
      className="w-fit"
    >
      <TabsList>
        <TabsTrigger
          value="all"
          disabled={disabled}
          className="px-4 py-2 text-body"
        >
          All Types
        </TabsTrigger>
        <TabsTrigger
          value="game"
          disabled={disabled}
          className="px-4 py-2 text-body"
        >
          Games
        </TabsTrigger>
        <TabsTrigger
          value="dlc"
          disabled={disabled}
          className="px-4 py-2 text-body"
        >
          DLC
        </TabsTrigger>
        <TabsTrigger
          value="demo"
          disabled={disabled}
          className="px-4 py-2 text-body"
        >
          Demos
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
