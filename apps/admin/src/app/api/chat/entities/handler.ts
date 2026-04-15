import { NextRequest, NextResponse } from 'next/server';

import { postToQueryApi } from '@/lib/query-api-client';
import { createServerClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import type {
  ChatEntityKind,
  ChatEntityMatchQuality,
  ChatEntityPickerRequest,
  ChatEntityPickerResponse,
  ChatEntityPickerResults,
  ChatEntityResolutionMode,
  ChatEntityResolutionPreference,
} from '@/lib/chat/chat-entity-picker';
import { inferAutocompleteEntityKinds } from '@/lib/chat/chat-entity-picker';

const DEFAULT_ENTITY_KINDS: ChatEntityKind[] = [
  'game',
  'publisher',
  'developer',
];

export interface ChatEntityRouteDeps {
  createServerClient: typeof createServerClient;
  postToQueryApi: typeof postToQueryApi;
  searchGameAutocomplete: typeof searchGameAutocompleteFallback;
}

const defaultDeps: ChatEntityRouteDeps = {
  createServerClient,
  postToQueryApi,
  searchGameAutocomplete: searchGameAutocompleteFallback,
};

function createEmptyResults(): ChatEntityPickerResults {
  return {
    ambiguity: {
      candidateNames: [],
      message: null,
      requiresClarification: false,
    },
    continuationToken: null,
    entities: [],
    provenance: {
      capturedAt: new Date().toISOString(),
      source: 'tiger',
      tables: [],
    },
    totalCandidates: 0,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function determineMatchQuality(query: string, candidateName: string): ChatEntityMatchQuality {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(candidateName);

  if (!normalizedQuery || !normalizedName) {
    return 'fuzzy';
  }
  if (normalizedName === normalizedQuery) {
    return 'exact';
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 'prefix';
  }
  if (normalizedName.includes(normalizedQuery)) {
    return 'substring';
  }
  return 'fuzzy';
}

function matchQualityRank(matchQuality: ChatEntityMatchQuality): number {
  switch (matchQuality) {
    case 'exact':
      return 0;
    case 'prefix':
      return 1;
    case 'substring':
      return 2;
    default:
      return 3;
  }
}

async function searchGameAutocompleteFallback(
  query: string,
  limit: number
): Promise<ChatEntityPickerResults> {
  const supabase = getServiceSupabase();
  const boundedLimit = Math.max(1, Math.min(limit, 10));
  const fetchLimit = Math.min(Math.max(boundedLimit * 3, 10), 25);

  const { data, error } = await supabase
    .from('apps')
    .select('appid, name, release_date')
    .eq('type', 'game')
    .eq('is_delisted', false)
    .ilike('name', `%${query}%`)
    .limit(fetchLimit);

  if (error) {
    throw error;
  }

  const entities = (data ?? [])
    .map((app) => {
      const matchQuality = determineMatchQuality(query, app.name);
      return {
        confidence:
          matchQuality === 'exact'
            ? 0.99
            : matchQuality === 'prefix'
              ? 0.92
              : matchQuality === 'substring'
                ? 0.84
                : 0.72,
        displayName: app.name,
        entityKind: 'game' as const,
        entityUid: `game:steam:${app.appid}`,
        matchQuality,
        matchedName: app.name,
        platform: 'steam' as const,
        platformEntityId: String(app.appid),
        releaseYear: app.release_date ? new Date(app.release_date).getFullYear() : null,
      };
    })
    .sort((left, right) => {
      const qualityDelta = matchQualityRank(left.matchQuality) - matchQualityRank(right.matchQuality);
      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      const lengthDelta = left.displayName.length - right.displayName.length;
      if (lengthDelta !== 0) {
        return lengthDelta;
      }

      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, boundedLimit);

  return {
    ambiguity: {
      candidateNames: [],
      message: null,
      requiresClarification: false,
    },
    continuationToken: null,
    entities,
    provenance: {
      capturedAt: new Date().toISOString(),
      source: 'supabase-fallback',
      tables: ['public.apps'],
    },
    totalCandidates: entities.length,
  };
}

function normalizeEntityKinds(entityKinds: unknown): ChatEntityKind[] {
  if (!Array.isArray(entityKinds)) {
    return DEFAULT_ENTITY_KINDS;
  }

  const allowedKinds = new Set<ChatEntityKind>([
    'game',
    'publisher',
    'developer',
  ]);

  const normalized = entityKinds.filter(
    (kind): kind is ChatEntityKind => typeof kind === 'string' && allowedKinds.has(kind as ChatEntityKind)
  );

  return normalized.length > 0 ? normalized : DEFAULT_ENTITY_KINDS;
}

function defaultAutocompleteEntityKinds(
  resolutionPreference: ChatEntityResolutionPreference | null
): ChatEntityKind[] {
  return inferAutocompleteEntityKinds(resolutionPreference);
}

function normalizeResolutionMode(value: unknown): ChatEntityResolutionMode | undefined {
  return value === 'autocomplete' || value === 'chat_strict' || value === 'default'
    ? value
    : undefined;
}

function normalizeResolutionPreference(value: unknown): ChatEntityResolutionPreference | null | undefined {
  if (value === 'game' || value === 'company') {
    return value;
  }

  return value == null ? null : undefined;
}

export async function handleChatEntityRequest(
  request: NextRequest,
  deps: ChatEntityRouteDeps = defaultDeps
): Promise<NextResponse<ChatEntityPickerResponse>> {
  const startTime = Date.now();

  try {
    const supabase = await deps.createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          query: '',
          results: createEmptyResults(),
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as Partial<ChatEntityPickerRequest> | null;
    const query = typeof body?.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json({
        success: true,
        query: '',
        results: createEmptyResults(),
      });
    }

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        query,
        results: createEmptyResults(),
      });
    }

    const limit = typeof body?.limit === 'number' ? Math.max(1, Math.min(body.limit, 10)) : 5;
    const continuationToken = typeof body?.continuationToken === 'string'
      ? body.continuationToken.trim() || null
      : null;
    const resolutionMode = normalizeResolutionMode(body?.resolutionMode);
    const resolutionPreference = normalizeResolutionPreference(body?.resolutionPreference);
    const requestedEntityKinds = Array.isArray(body?.entityKinds)
      ? normalizeEntityKinds(body?.entityKinds)
      : null;
    const entityKinds = resolutionMode === 'autocomplete'
      ? (Array.isArray(body?.entityKinds) && body.entityKinds.length > 0
          ? requestedEntityKinds ?? defaultAutocompleteEntityKinds(resolutionPreference ?? 'game')
          : defaultAutocompleteEntityKinds(resolutionPreference ?? 'game'))
      : requestedEntityKinds ?? normalizeEntityKinds(body?.entityKinds);
    const includeMetrics = resolutionMode === 'autocomplete'
      ? false
      : body?.includeMetrics ?? true;
    const allowGameAutocompleteFallback =
      resolutionMode === 'autocomplete'
      && entityKinds.length === 1
      && entityKinds[0] === 'game';

    const result = await deps.postToQueryApi<ChatEntityPickerResults>(
      '/v1/contracts/resolve-entities',
      {
        entityKinds,
        continuationToken,
        includeMetrics,
        limit,
        query,
        ...(resolutionMode ? { resolutionMode } : {}),
        ...(resolutionPreference !== undefined ? { resolutionPreference } : {}),
      }
    );

    if (!result.ok || !result.data) {
      if (allowGameAutocompleteFallback) {
        try {
          const fallbackResults = await deps.searchGameAutocomplete(query, limit);
          return NextResponse.json({
            success: true,
            query,
            results: fallbackResults,
            timing: {
              total_ms: Date.now() - startTime,
            },
          });
        } catch (fallbackError) {
          console.error('Chat entity fallback search error:', fallbackError);
        }
      }

      return NextResponse.json(
        {
          success: false,
          query,
          results: createEmptyResults(),
          error: result.reason ?? 'Unable to resolve entities',
        },
        { status: result.httpStatus ?? 502 }
      );
    }

    return NextResponse.json({
      success: true,
      query,
      results: result.data,
      timing: {
        total_ms: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('Chat entity API error:', error);
    return NextResponse.json(
      {
        success: false,
        query: '',
        results: createEmptyResults(),
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
