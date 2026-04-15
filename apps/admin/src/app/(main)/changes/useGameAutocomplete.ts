'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatEntityPickerEntity, ChatEntityPickerResponse } from '@/lib/chat/chat-entity-picker';

const MIN_QUERY_LENGTH = 2;
const REQUEST_DEBOUNCE_MS = 180;
const CACHE_TTL_MS = 60_000;
const AUTOCOMPLETE_LIMIT = 6;

interface CacheEntry {
  cachedAt: number;
  entities: ChatEntityPickerEntity[];
  query: string;
}

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface UseGameAutocompleteResult {
  entities: ChatEntityPickerEntity[];
  isLoading: boolean;
  error: string | null;
}

export function useGameAutocomplete(query: string): UseGameAutocompleteResult {
  const [entities, setEntities] = useState<ChatEntityPickerEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const normalized = normalizeQuery(trimmed);

    if (normalized.length < MIN_QUERY_LENGTH) {
      controllerRef.current?.abort();
      setEntities([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cacheRef.current.get(normalized);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      setEntities(cached.entities);
      setIsLoading(false);
      setError(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsLoading(true);
      setError(null);

      void (async () => {
        try {
          const response = await fetch('/api/chat/entities', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: trimmed,
              limit: AUTOCOMPLETE_LIMIT,
              resolutionMode: 'autocomplete',
              resolutionPreference: 'game',
              entityKinds: ['game'],
              includeMetrics: false,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = (await response.json()) as ChatEntityPickerResponse;
          if (controller.signal.aborted) {
            return;
          }

          const nextEntities = payload.results.entities;
          setEntities(nextEntities);
          cacheRef.current.set(normalized, {
            cachedAt: Date.now(),
            entities: nextEntities,
            query: normalized,
          });
        } catch (nextError) {
          if (controller.signal.aborted) {
            return;
          }

          setEntities([]);
          setError(nextError instanceof Error ? nextError.message : 'Autocomplete unavailable');
        } finally {
          if (controllerRef.current === controller) {
            setIsLoading(false);
          }
        }
      })();
    }, REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controllerRef.current?.abort();
    };
  }, [query]);

  return { entities, isLoading, error };
}
