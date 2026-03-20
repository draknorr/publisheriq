import { getServiceSupabase } from '@/lib/supabase-service';

export type CompanyEntityType = 'publisher' | 'developer';
export type ResolutionConfidence = 'high' | 'medium' | 'low';
export type CompanyMatchKind = 'exact' | 'core_exact' | 'prefix' | 'substring' | 'fuzzy';

interface FuzzyLookupRow {
  id: number;
  name: string;
  similarity_score: number | null;
  is_exact_match: boolean | null;
}

interface CompanyMetricsRow {
  id: number;
  name: string;
  gameCount: number | null;
  totalReviews: number | null;
  avgReviewScore: number | null;
  positiveReviews: number | null;
  gamesReleasedLastYear: number | null;
  genreIds: number[] | null;
  tagIds: number[] | null;
}

export interface CompanyResolutionCandidate {
  id: number;
  name: string;
  similarityScore?: number;
  isExactMatch?: boolean;
  gameCount?: number;
  totalReviews?: number;
  avgReviewScore?: number;
  positiveReviews?: number;
  gamesReleasedLastYear?: number;
  genreIds?: number[];
  tagIds?: number[];
  resolutionScore: number;
  matchKind: CompanyMatchKind;
}

export interface CanonicalCompanyResult {
  id: number;
  name: string;
  confidence: ResolutionConfidence;
}

export interface CompanyResolutionResult {
  success: boolean;
  entityType: CompanyEntityType;
  query: string;
  results: CompanyResolutionCandidate[];
  canonicalResult?: CanonicalCompanyResult;
  resolutionConfidence?: ResolutionConfidence;
  needsDisambiguation?: boolean;
  error?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RESULTS = 20;

const LEGAL_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'gmbh',
  'sa',
  'sarl',
  'bv',
  'oy',
  'ag',
  'kg',
  'kk',
]);

const resolutionCache = new Map<string, { expiresAt: number; value: CompanyResolutionResult }>();

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripLegalSuffixes(value: string): string {
  const tokens = normalizeCompanyName(value).split(' ').filter(Boolean);

  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (!LEGAL_SUFFIXES.has(last)) {
      break;
    }
    tokens.pop();
  }

  return tokens.join(' ');
}

function cacheKey(entityType: CompanyEntityType, query: string, limit: number): string {
  return `${entityType}:${normalizeCompanyName(query)}:${Math.min(limit, MAX_RESULTS)}`;
}

function readCache(key: string): CompanyResolutionResult | null {
  const cached = resolutionCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    resolutionCache.delete(key);
    return null;
  }

  return cached.value;
}

function writeCache(key: string, value: CompanyResolutionResult): void {
  resolutionCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
}

async function fetchFuzzyCandidates(
  entityType: CompanyEntityType,
  query: string,
  limit: number
): Promise<FuzzyLookupRow[]> {
  const supabase = getServiceSupabase();
  const rpcName = entityType === 'publisher' ? 'search_publishers_fuzzy' : 'search_developers_fuzzy';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(rpcName, {
    p_query: query,
    p_limit: Math.min(limit, MAX_RESULTS),
  }) as {
    data: FuzzyLookupRow[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    return [];
  }

  return data;
}

async function fetchIlikeFallback(
  entityType: CompanyEntityType,
  query: string,
  limit: number
): Promise<FuzzyLookupRow[]> {
  const supabase = getServiceSupabase();
  const table = entityType === 'publisher' ? 'publishers' : 'developers';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table as any) as any)
    .select('id, name')
    .ilike('name', `%${query.trim()}%`)
    .order('name')
    .limit(Math.min(limit, MAX_RESULTS));

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row: { id: number; name: string }) => ({
    id: row.id,
    name: row.name,
    similarity_score: null,
    is_exact_match: null,
  }));
}

async function fetchMetricsMap(
  entityType: CompanyEntityType,
  ids: number[]
): Promise<Map<number, CompanyMetricsRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabase();
  const table = entityType === 'publisher' ? 'publisher_metrics' : 'developer_metrics';
  const idColumn = entityType === 'publisher' ? 'publisher_id' : 'developer_id';
  const nameColumn = entityType === 'publisher' ? 'publisher_name' : 'developer_name';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table as any) as any)
    .select(
      `${idColumn}, ${nameColumn}, game_count, total_reviews, avg_review_score, positive_reviews, games_released_last_year, genre_ids, tag_ids`
    )
    .in(idColumn, ids);

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  return new Map(
    data.map((row: Record<string, unknown>) => [
      Number(row[idColumn]),
      {
        id: Number(row[idColumn]),
        name: String(row[nameColumn] ?? ''),
        gameCount: row.game_count as number | null,
        totalReviews: row.total_reviews as number | null,
        avgReviewScore: row.avg_review_score as number | null,
        positiveReviews: row.positive_reviews as number | null,
        gamesReleasedLastYear: row.games_released_last_year as number | null,
        genreIds: (row.genre_ids as number[] | null) ?? null,
        tagIds: (row.tag_ids as number[] | null) ?? null,
      },
    ])
  );
}

function matchKindForCandidate(
  queryName: string,
  candidateName: string,
  isExactMatch: boolean | undefined
): CompanyMatchKind {
  const normalizedQuery = normalizeCompanyName(queryName);
  const normalizedCandidate = normalizeCompanyName(candidateName);
  const coreQuery = stripLegalSuffixes(queryName);
  const coreCandidate = stripLegalSuffixes(candidateName);

  if (normalizedCandidate === normalizedQuery) {
    return 'exact';
  }

  if (coreCandidate === coreQuery) {
    return 'core_exact';
  }

  if (normalizedCandidate.startsWith(normalizedQuery) || coreCandidate.startsWith(coreQuery)) {
    return 'prefix';
  }

  if (isExactMatch || normalizedCandidate.includes(normalizedQuery)) {
    return 'substring';
  }

  return 'fuzzy';
}

function resolutionScoreForCandidate(
  candidate: Omit<CompanyResolutionCandidate, 'resolutionScore'>
): number {
  const matchScore =
    candidate.matchKind === 'exact'
      ? 120
      : candidate.matchKind === 'core_exact'
        ? 110
        : candidate.matchKind === 'prefix'
          ? 95
          : candidate.matchKind === 'substring'
            ? 80
            : 55;

  const similarityScore = (candidate.similarityScore ?? 0) * 25;
  const gameCountScore = Math.min(candidate.gameCount ?? 0, 20) * 1.25;
  const reviewVolumeScore = Math.log10((candidate.totalReviews ?? 0) + 1) * 18;
  const recentReleaseScore = Math.min(candidate.gamesReleasedLastYear ?? 0, 5) * 2;
  const reviewQualityScore = candidate.avgReviewScore ? Math.max(candidate.avgReviewScore - 70, 0) / 5 : 0;

  return Number(
    (matchScore + similarityScore + gameCountScore + reviewVolumeScore + recentReleaseScore + reviewQualityScore)
      .toFixed(2)
  );
}

function confidenceForResults(results: CompanyResolutionCandidate[]): ResolutionConfidence {
  const [best, second] = results;
  if (!best) {
    return 'low';
  }

  const gap = best.resolutionScore - (second?.resolutionScore ?? 0);

  if ((best.matchKind === 'exact' || best.matchKind === 'core_exact') && gap >= 15) {
    return 'high';
  }

  if (best.resolutionScore >= 150 && gap >= 12) {
    return 'high';
  }

  if (gap >= 8) {
    return 'medium';
  }

  return 'low';
}

function dedupeCandidates(rows: FuzzyLookupRow[]): FuzzyLookupRow[] {
  const seen = new Set<number>();
  const deduped: FuzzyLookupRow[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    deduped.push(row);
  }

  return deduped;
}

function buildAmbiguousCompanyError(
  entityType: CompanyEntityType,
  query: string,
  candidates: CompanyResolutionCandidate[]
): string {
  const labels = candidates
    .slice(0, 5)
    .map((candidate) => candidate.name)
    .join(', ');

  return `The ${entityType} name "${query}" matched multiple companies. Ask the user to clarify which one they mean: ${labels}.`;
}

export async function resolveCompanyReference(
  entityType: CompanyEntityType,
  query: string,
  limit = 10
): Promise<CompanyResolutionResult> {
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      entityType,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  const maxResults = Math.min(limit, MAX_RESULTS);
  const key = cacheKey(entityType, query, maxResults);
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const fuzzyCandidates = await fetchFuzzyCandidates(entityType, query, maxResults);
  const fallbackCandidates = fuzzyCandidates.length === 0
    ? await fetchIlikeFallback(entityType, query, maxResults)
    : [];

  const rawCandidates = dedupeCandidates(
    fuzzyCandidates.length > 0 ? fuzzyCandidates : fallbackCandidates
  );

  if (rawCandidates.length === 0) {
    const emptyResult: CompanyResolutionResult = {
      success: true,
      entityType,
      query,
      results: [],
    };
    writeCache(key, emptyResult);
    return emptyResult;
  }

  const metricsMap = await fetchMetricsMap(
    entityType,
    rawCandidates.map((candidate) => candidate.id)
  );

  const rankedResults = rawCandidates
    .map((candidate): CompanyResolutionCandidate => {
      const metrics = metricsMap.get(candidate.id);
      const matchKind = matchKindForCandidate(query, candidate.name, candidate.is_exact_match ?? undefined);
      const baseCandidate: Omit<CompanyResolutionCandidate, 'resolutionScore'> = {
        id: candidate.id,
        name: metrics?.name || candidate.name,
        similarityScore: candidate.similarity_score ?? undefined,
        isExactMatch: candidate.is_exact_match ?? undefined,
        gameCount: metrics?.gameCount ?? undefined,
        totalReviews: metrics?.totalReviews ?? undefined,
        avgReviewScore: metrics?.avgReviewScore ?? undefined,
        positiveReviews: metrics?.positiveReviews ?? undefined,
        gamesReleasedLastYear: metrics?.gamesReleasedLastYear ?? undefined,
        genreIds: metrics?.genreIds ?? undefined,
        tagIds: metrics?.tagIds ?? undefined,
        matchKind,
      };

      return {
        ...baseCandidate,
        resolutionScore: resolutionScoreForCandidate(baseCandidate),
      };
    })
    .sort((left, right) => right.resolutionScore - left.resolutionScore)
    .slice(0, maxResults);

  const confidence = confidenceForResults(rankedResults);
  const needsDisambiguation = rankedResults.length > 1 && confidence === 'low';
  const result: CompanyResolutionResult = {
    success: true,
    entityType,
    query,
    results: rankedResults,
    canonicalResult: rankedResults[0]
      ? {
          id: rankedResults[0].id,
          name: rankedResults[0].name,
          confidence,
        }
      : undefined,
    resolutionConfidence: confidence,
    needsDisambiguation,
    error: needsDisambiguation ? buildAmbiguousCompanyError(entityType, query, rankedResults) : undefined,
  };

  writeCache(key, result);
  return result;
}

