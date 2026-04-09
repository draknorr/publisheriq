/**
 * Game Lookup Service
 *
 * Provides efficient database lookups for game names.
 * Prefers the trigram-backed fuzzy search RPC and falls back to ILIKE.
 */

import {
  attachToolExecutionProvenance,
  type ChatExecutionProvenanceOverride,
} from '@/lib/chat/execution-trace';
import { postToQueryApi } from '@/lib/query-api-client';

/**
 * Arguments for lookup_games tool
 */
export interface LookupGamesArgs {
  query: string;
  limit?: number;
}

export type LookupGameMatchQuality = 'exact' | 'prefix' | 'substring' | 'fuzzy';
export type LookupGameMatchSource =
  | 'platform_entity_id'
  | 'canonical_name'
  | 'normalized_name'
  | 'alias'
  | 'normalized_alias'
  | 'legacy_name';
export type LookupGameResolutionTier =
  | 'platform_id_exact'
  | 'canonical_exact'
  | 'alias_exact'
  | 'normalized_exact'
  | 'canonical_prefix'
  | 'alias_prefix'
  | 'legacy_prefix'
  | 'canonical_substring'
  | 'alias_substring'
  | 'legacy_substring'
  | 'legacy_exact'
  | 'fuzzy';

export interface LookupGameCandidate {
  appid: number;
  name: string;
  releaseYear: number | null;
  similarityScore?: number;
  isExactMatch?: boolean;
  matchQuality?: LookupGameMatchQuality | null;
  matchSource?: LookupGameMatchSource | null;
  resolutionTier?: LookupGameResolutionTier | null;
}

/**
 * Result from lookup_games
 */
export interface LookupGamesResult {
  success: boolean;
  query: string;
  results: LookupGameCandidate[];
  candidates?: LookupGameCandidate[];
  canonicalResult?: {
    appid: number;
    confidence: 'high' | 'medium' | 'low';
    name: string;
  };
  ambiguity?: {
    candidateNames: string[];
    continuationToken?: string | null;
    message: string | null;
    requiresClarification: boolean;
    totalCandidates?: number | null;
  };
  resolutionConfidence?: 'high' | 'medium' | 'low';
  matchSource?: LookupGameMatchSource | null;
  resolutionTier?: LookupGameResolutionTier | null;
  needsDisambiguation?: boolean;
  error?: string;
  unavailable?: boolean;
}

interface ResolveEntitiesResponse {
  ambiguity?: {
    candidateNames?: string[];
    continuationToken?: string | null;
    message: string | null;
    requiresClarification: boolean;
    totalCandidates?: number | null;
  };
  continuationToken?: string | null;
  entities?: Array<{
    confidence: number;
    displayName: string;
    entityKind: 'developer' | 'game' | 'publisher';
    matchQuality: 'exact' | 'prefix' | 'substring' | 'fuzzy';
    matchSource?: LookupGameMatchSource | null;
    platformEntityId: string;
    releaseYear?: number | null;
    resolutionTier?: LookupGameResolutionTier | null;
  }>;
  totalCandidates?: number;
}

const TIGER_GAME_LOOKUP_PROVENANCE: ChatExecutionProvenanceOverride = {
  backendKinds: ['tiger_query_api'],
  dataSources: [
    'query_api:resolveEntities',
    'relation:apps',
    'relation:latest_daily_metrics',
    'relation:publishers',
    'relation:developers',
  ],
  migrationDisposition: 'already_tiger',
  migrationNotes:
    'lookup_games now uses the system resolve-entities contract before falling back to legacy fuzzy lookup.',
  recommendedTigerContracts: ['resolveEntities'],
};

function buildTigerOnlyLookupFailure(query: string, reason: string): LookupGamesResult {
  return {
    success: false,
    query,
    results: [],
    error: reason,
    unavailable: true,
  };
}

function parseAppId(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const appid = Number.parseInt(value, 10);
  return Number.isFinite(appid) ? appid : null;
}

function inferResolutionConfidence(score: number | undefined): 'high' | 'medium' | 'low' {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'low';
  }

  if (score >= 0.9) {
    return 'high';
  }

  if (score >= 0.75) {
    return 'medium';
  }

  return 'low';
}

function buildAmbiguousGameError(query: string, candidates: LookupGameCandidate[]): string {
  const labels = candidates
    .slice(0, 5)
    .map((candidate) => candidate.releaseYear ? `${candidate.name} (${candidate.releaseYear})` : candidate.name);

  if (labels.length === 0) {
    return `The game name "${query}" is ambiguous and needs clarification.`;
  }

  return `The game name "${query}" matched multiple Steam titles. Ask the user to clarify which one they mean: ${labels.join(', ')}.`;
}

function mapTigerGameCandidate(
  entity: NonNullable<ResolveEntitiesResponse['entities']>[number]
): LookupGameCandidate | null {
  const appid = parseAppId(entity.platformEntityId);
  if (appid == null) {
    return null;
  }

  return {
    appid,
    isExactMatch: entity.matchQuality === 'exact',
    matchQuality: entity.matchQuality,
    matchSource: entity.matchSource ?? null,
    name: entity.displayName,
    releaseYear: entity.releaseYear ?? null,
    resolutionTier: entity.resolutionTier ?? null,
    similarityScore: entity.confidence,
  };
}

/**
 * Search for matching game names using direct database query
 */
export async function lookupGames(args: LookupGamesArgs): Promise<LookupGamesResult> {
  const { query, limit = 10 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  try {
    const maxResults = Math.min(limit, 20); // Hard cap at 20
    const trimmedQuery = query.trim();

    const tigerResponse = await postToQueryApi<ResolveEntitiesResponse>(
      '/v1/contracts/resolve-entities',
      {
        entityKinds: ['game'],
        includeMetrics: false,
        limit: maxResults,
        resolutionMode: 'chat_strict',
        query: trimmedQuery,
      }
    );

    if (tigerResponse.ok && tigerResponse.data) {
      const tigerResults = (tigerResponse.data.entities ?? [])
        .filter((entity) => entity.entityKind === 'game')
        .map((entity) => mapTigerGameCandidate(entity))
        .filter((entity): entity is LookupGameCandidate => entity != null);

      const topCandidate = tigerResults[0] ?? null;
      const resolutionConfidence = inferResolutionConfidence(topCandidate?.similarityScore);
      const tigerAmbiguity = tigerResponse.data.ambiguity ?? null;
      const needsDisambiguation =
        tigerAmbiguity?.requiresClarification === true
        || (tigerResults.length > 1 && resolutionConfidence === 'low');

      return attachToolExecutionProvenance(
        {
          ambiguity: tigerAmbiguity
            ? {
                candidateNames: tigerAmbiguity.candidateNames ?? tigerResults.map((candidate) => candidate.name),
                continuationToken: tigerAmbiguity.continuationToken ?? tigerResponse.data.continuationToken ?? null,
                message: tigerAmbiguity.message,
                requiresClarification: tigerAmbiguity.requiresClarification,
                totalCandidates: tigerAmbiguity.totalCandidates ?? tigerResponse.data.totalCandidates ?? tigerResults.length,
              }
            : {
                candidateNames: needsDisambiguation ? tigerResults.map((candidate) => candidate.name) : [],
                continuationToken: tigerResponse.data.continuationToken ?? null,
                message: needsDisambiguation ? buildAmbiguousGameError(query, tigerResults) : null,
                requiresClarification: needsDisambiguation,
                totalCandidates: tigerResponse.data.totalCandidates ?? tigerResults.length,
              },
          canonicalResult: topCandidate
            ? {
                appid: topCandidate.appid,
                confidence: resolutionConfidence,
                name: topCandidate.name,
              }
            : undefined,
          candidates: tigerResults,
          matchSource: topCandidate?.matchSource ?? null,
          needsDisambiguation,
          success: true,
          query,
          resolutionConfidence,
          resolutionTier: topCandidate?.resolutionTier ?? null,
          results: tigerResults,
        },
        TIGER_GAME_LOOKUP_PROVENANCE
      );
    }

    return buildTigerOnlyLookupFailure(
      query,
      tigerResponse.reason ?? `No game match was found for "${trimmedQuery}".`
    );
  } catch (error) {
    return buildTigerOnlyLookupFailure(
      query,
      error instanceof Error ? error.message : 'Failed to lookup games'
    );
  }
}
