'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ChatToolCall } from '@/lib/llm/types';

/**
 * Entity mappings extracted from tool results
 * Maps entity names (case-insensitive) to their IDs for auto-linking
 */
export interface EntityMappings {
  games: Map<string, number>;      // gameName/name -> appid
  developers: Map<string, number>; // developerName -> developerId
  publishers: Map<string, number>; // publisherName -> publisherId
}

const EntityLinkContext = createContext<EntityMappings | null>(null);

/**
 * Extract entity mappings from tool call results
 * Scans through the data arrays in tool results to build name->ID mappings
 */
export function extractEntityMappings(toolCalls?: ChatToolCall[]): EntityMappings {
  const games = new Map<string, number>();
  const developers = new Map<string, number>();
  const publishers = new Map<string, number>();

  if (!toolCalls) return { games, developers, publishers };

  for (const tc of toolCalls) {
    const result = tc.result as { data?: Record<string, unknown>[]; results?: Record<string, unknown>[] } | undefined;
    if (!result) continue;

    // Handle query_analytics, search_games results (have 'data' array)
    // Ensure we have an actual array before iterating (result.data could be an object)
    const dataArray = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.results)
        ? result.results
        : [];

    for (const row of dataArray) {
      // Extract game mappings - check various field patterns
      const appid = row.appid as number | undefined;
      if (appid) {
        // gameName field (from DeveloperGameMetrics, PublisherGameMetrics)
        if (row.gameName && typeof row.gameName === 'string') {
          // Handle pre-formatted links: "[Game Name](game:123)" -> "Game Name"
          const plainName = extractPlainName(row.gameName);
          games.set(plainName.toLowerCase(), appid);
        }
        // name field (from Discovery, search_games)
        if (row.name && typeof row.name === 'string') {
          const plainName = extractPlainName(row.name);
          games.set(plainName.toLowerCase(), appid);
        }
      }

      // Handle find_similar results (have 'id' and 'type' fields)
      const id = row.id as number | undefined;
      const type = row.type as string | undefined;
      const name = row.name as string | undefined;
      if (id && name && type) {
        const plainName = extractPlainName(name);
        if (type === 'game') {
          games.set(plainName.toLowerCase(), id);
        } else if (type === 'developer') {
          developers.set(plainName.toLowerCase(), id);
        } else if (type === 'publisher') {
          publishers.set(plainName.toLowerCase(), id);
        }
      }

      // Extract developer mappings
      const developerId = row.developerId as number | undefined;
      if (developerId && row.developerName && typeof row.developerName === 'string') {
        const plainName = extractPlainName(row.developerName);
        developers.set(plainName.toLowerCase(), developerId);
      }

      // Extract publisher mappings
      const publisherId = row.publisherId as number | undefined;
      if (publisherId && row.publisherName && typeof row.publisherName === 'string') {
        const plainName = extractPlainName(row.publisherName);
        publishers.set(plainName.toLowerCase(), publisherId);
      }
    }
  }

  return { games, developers, publishers };
}

/**
 * Extract plain text name from potentially pre-formatted markdown link
 * "[Game Name](game:123)" -> "Game Name"
 * "Plain Name" -> "Plain Name"
 */
function extractPlainName(text: string): string {
  // Match markdown link pattern: [Name](url)
  const linkMatch = text.match(/^\[([^\]]+)\]\([^)]+\)$/);
  if (linkMatch) {
    return linkMatch[1];
  }
  return text;
}

interface EntityLinkProviderProps {
  toolCalls?: ChatToolCall[];
  children: ReactNode;
}

export function EntityLinkProvider({ toolCalls, children }: EntityLinkProviderProps) {
  const mappings = useMemo(() => extractEntityMappings(toolCalls), [toolCalls]);

  return (
    <EntityLinkContext.Provider value={mappings}>
      {children}
    </EntityLinkContext.Provider>
  );
}

export function useEntityMappings(): EntityMappings | null {
  return useContext(EntityLinkContext);
}

/**
 * Try to auto-link a plain text cell value using entity mappings
 * Returns the linked version if found, otherwise null
 */
export function tryAutoLink(text: string, mappings: EntityMappings | null): { type: 'game' | 'developer' | 'publisher'; id: number; name: string } | null {
  if (!mappings) return null;

  const normalizedText = text.trim().toLowerCase();

  // Try games first (most common)
  const gameId = mappings.games.get(normalizedText);
  if (gameId) {
    return { type: 'game', id: gameId, name: text.trim() };
  }

  // Try developers
  const developerId = mappings.developers.get(normalizedText);
  if (developerId) {
    return { type: 'developer', id: developerId, name: text.trim() };
  }

  // Try publishers
  const publisherId = mappings.publishers.get(normalizedText);
  if (publisherId) {
    return { type: 'publisher', id: publisherId, name: text.trim() };
  }

  return null;
}
