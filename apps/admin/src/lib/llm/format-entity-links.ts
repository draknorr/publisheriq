/**
 * Format tool results with entity links
 *
 * Pre-formats game, developer, and publisher names as markdown links
 * before sending to the LLM. This ensures consistent entity linking
 * regardless of LLM behavior.
 */

interface ResultWithData {
  success?: boolean;
  data?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
  candidates?: Record<string, unknown>[];
  app?: Record<string, unknown>;
  detail?: Record<string, unknown>;
  reference?: Record<string, unknown>;
  entityType?: 'publisher' | 'developer';
  canonicalResult?: Record<string, unknown>;
  [key: string]: unknown;
}

interface FormatResultOptions {
  compact?: boolean;
  maxRows?: number;
}

function formatNestedTitleCollections(row: Record<string, unknown>): Record<string, unknown> {
  const formatted = { ...row };

  for (const key of ['representativeTitles', 'flagshipTitles']) {
    const titles = row[key];
    if (!Array.isArray(titles)) {
      continue;
    }

    formatted[key] = titles.map((title) => {
      if (!title || typeof title !== 'object') {
        return title;
      }

      const typedTitle = title as Record<string, unknown>;
      const appid = typedTitle.appid as number | undefined;
      const name = typedTitle.name as string | undefined;

      if (appid && name && !name.startsWith('[')) {
        return {
          ...typedTitle,
          name: `[${name}](game:${appid})`,
        };
      }

      return typedTitle;
    });
  }

  return formatted;
}

/**
 * Format a single data row with entity links
 */
function formatRowWithLinks(row: Record<string, unknown>): Record<string, unknown> {
  const formatted = formatNestedTitleCollections(row);

  // Format game links - check various field name patterns
  const appid = row.appid as number | undefined;
  if (appid) {
    // gameName field (from DeveloperGameMetrics, PublisherGameMetrics)
    if (row.gameName && typeof row.gameName === 'string') {
      formatted.gameName = `[${row.gameName}](game:${appid})`;
    }
    // name field (from Discovery, search_games)
    if (row.name && typeof row.name === 'string') {
      formatted.name = `[${row.name}](game:${appid})`;
    }
    // appName field (from change-intel activity/detail surfaces)
    if (row.appName && typeof row.appName === 'string') {
      formatted.appName = `[${row.appName}](game:${appid})`;
    }
  }

  // Format other game-name pairs like parentAppid/parentName or dlcAppid/dlcName.
  for (const [key, value] of Object.entries(row)) {
    if (!key.endsWith('Appid') || typeof value !== 'number') continue;

    const nameKey = `${key.slice(0, -5)}Name`;
    const rawName = row[nameKey];
    if (typeof rawName !== 'string' || rawName.startsWith('[')) continue;

    formatted[nameKey] = `[${rawName}](game:${value})`;
  }

  // Format developer links
  const developerId = row.developerId as number | undefined;
  if (developerId && row.developerName && typeof row.developerName === 'string') {
    formatted.developerName = `[${row.developerName}](/developers/${developerId})`;
  }

  // Format publisher links
  const publisherId = row.publisherId as number | undefined;
  if (publisherId && row.publisherName && typeof row.publisherName === 'string') {
    formatted.publisherName = `[${row.publisherName}](/publishers/${publisherId})`;
  }

  return formatted;
}

/**
 * Format find_similar results with entity links
 * These have a different structure with 'results' array and 'type' field
 */
function formatSimilarityResults(
  results: Record<string, unknown>[]
): Record<string, unknown>[] {
  return results.map((item) => {
    const formatted = formatNestedTitleCollections(item);
    const id = item.id as number | undefined;
    const name = item.name as string | undefined;
    const type = item.type as string | undefined;

    if (id && name) {
      if (type === 'game') {
        formatted.name = `[${name}](game:${id})`;
      } else if (type === 'developer') {
        formatted.name = `[${name}](/developers/${id})`;
      } else if (type === 'publisher') {
        formatted.name = `[${name}](/publishers/${id})`;
      }
    }

    return formatted;
  });
}

function formatEntityResults(
  entityType: 'publisher' | 'developer',
  results: Record<string, unknown>[]
): Record<string, unknown>[] {
  return results.map((item) => {
    const formatted = { ...item };
    const id = item.id as number | undefined;
    const name = item.name as string | undefined;

    if (id && name) {
      formatted.name = entityType === 'publisher'
        ? `[${name}](/publishers/${id})`
        : `[${name}](/developers/${id})`;
    }

    return formatted;
  });
}

function formatReference(reference: Record<string, unknown>): Record<string, unknown> {
  const formatted = { ...reference };
  const id = reference.id as number | undefined;
  const name = reference.name as string | undefined;
  const type = reference.type as string | undefined;

  if (!id || !name || !type) {
    return formatted;
  }

  if (type === 'game') {
    formatted.name = `[${name}](game:${id})`;
  } else if (type === 'publisher') {
    formatted.name = `[${name}](/publishers/${id})`;
  } else if (type === 'developer') {
    formatted.name = `[${name}](/developers/${id})`;
  }

  return formatted;
}

/**
 * Format tool result with entity links before sending to LLM
 *
 * Transforms raw tool results to include markdown entity links,
 * ensuring the LLM can pass them through directly without needing
 * to construct links itself.
 */
function prepareResultWithEntityLinks(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const typedResult = result as ResultWithData;

  if (Array.isArray(typedResult.candidates) && typedResult.candidates.length > 0) {
    const formattedCandidates =
      typedResult.entityType === 'publisher' || typedResult.entityType === 'developer'
        ? formatEntityResults(typedResult.entityType, typedResult.candidates as Record<string, unknown>[])
        : typedResult.candidates.map((row) => formatRowWithLinks(row as Record<string, unknown>));
    const formattedCanonical =
      typedResult.canonicalResult &&
      (typedResult.entityType === 'publisher' || typedResult.entityType === 'developer')
        ? formatEntityResults(typedResult.entityType, [typedResult.canonicalResult])[0]
        : typedResult.canonicalResult;
    const formattedReference =
      typedResult.reference && typeof typedResult.reference === 'object'
        ? formatReference(typedResult.reference)
        : typedResult.reference;
    return {
      ...typedResult,
      candidates: formattedCandidates,
      canonicalResult: formattedCanonical,
      reference: formattedReference,
    };
  }

  // Handle query_analytics and search_games results (have 'data' array)
  if (Array.isArray(typedResult.data) && typedResult.data.length > 0) {
    const formattedData = typedResult.data.map((row) =>
      formatRowWithLinks(row as Record<string, unknown>)
    );

    return { ...typedResult, data: formattedData };
  }

  if (typedResult.app && typeof typedResult.app === 'object') {
    const formattedApp = formatRowWithLinks(typedResult.app);
    const formattedReference =
      typedResult.reference && typeof typedResult.reference === 'object'
        ? formatReference(typedResult.reference)
        : typedResult.reference;
    return { ...typedResult, app: formattedApp, reference: formattedReference };
  }

  if (typedResult.detail && typeof typedResult.detail === 'object') {
    const formattedDetail = formatRowWithLinks(typedResult.detail);
    const formattedReference =
      typedResult.reference && typeof typedResult.reference === 'object'
        ? formatReference(typedResult.reference)
        : typedResult.reference;
    return { ...typedResult, detail: formattedDetail, reference: formattedReference };
  }

  // Handle find_similar results (have 'results' array with 'type' field)
  if (Array.isArray(typedResult.results) && typedResult.results.length > 0) {
    const results = typedResult.results as Record<string, unknown>[];
    const hasTypedSimilarityResults = results.some((item) => typeof item.type === 'string');
    const formattedResults =
      hasTypedSimilarityResults
        ? formatSimilarityResults(results)
        : typedResult.entityType === 'publisher' || typedResult.entityType === 'developer'
          ? formatEntityResults(typedResult.entityType, results)
          : results.map((row) => formatRowWithLinks(row));
    const formattedCanonical =
      typedResult.canonicalResult &&
      (typedResult.entityType === 'publisher' || typedResult.entityType === 'developer')
        ? formatEntityResults(typedResult.entityType, [typedResult.canonicalResult])[0]
        : typedResult.canonicalResult;
    const formattedReference =
      typedResult.reference && typeof typedResult.reference === 'object'
        ? formatReference(typedResult.reference)
        : typedResult.reference;
    return {
      ...typedResult,
      results: formattedResults,
      canonicalResult: formattedCanonical,
      reference: formattedReference,
    };
  }

  // Handle unsuccessful results - return as-is
  if (typedResult.success === false) {
    if (typedResult.reference && typeof typedResult.reference === 'object') {
      return {
        ...typedResult,
        reference: formatReference(typedResult.reference),
      };
    }
    return result;
  }

  // No data to format - return as-is
  return result;
}

function compactMetricsWindow(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const compact = {
    ccuPeak: candidate.ccuPeak ?? null,
    totalReviews: candidate.totalReviews ?? null,
    reviewScore: candidate.reviewScore ?? null,
    reviewScoreLabel: candidate.reviewScoreLabel ?? null,
    priceCents: candidate.priceCents ?? null,
    discountPercent: candidate.discountPercent ?? null,
  };

  return Object.values(compact).some((field) => field != null) ? compact : null;
}

function compactRow(row: Record<string, unknown>): Record<string, unknown> {
  const preferredKeys = [
    'appid',
    'name',
    'appName',
    'activityId',
    'occurredAt',
    'headline',
    'summary',
    'storyKind',
    'signalFamilies',
    'highlightLabels',
    'facts',
    'label',
    'beforeText',
    'afterText',
    'note',
    'added',
    'removed',
    'reviewsAdded7d',
    'reviewsAdded30d',
    'velocity7d',
    'velocity30d',
    'velocityAcceleration',
    'totalReviews',
    'reviewPercentage',
    'reviewScore',
    'ccuPeak',
    'priceDollars',
    'discountPercent',
    'positivePercentage',
    'reasons',
    'confidence',
    'primaryProof',
  ];

  const compact: Record<string, unknown> = {};

  for (const key of preferredKeys) {
    const value = row[key];
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      compact[key] = value.slice(0, ['facts', 'highlightLabels', 'added', 'removed'].includes(key) ? 3 : 5);
      continue;
    }

    if (key === 'primaryProof' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const proof = value as Record<string, unknown>;
      compact[key] = {
        activityId: proof.activityId ?? null,
        occurredAt: proof.occurredAt ?? null,
        headline: proof.headline ?? null,
        summary: proof.summary ?? null,
        facts: Array.isArray(proof.facts) ? proof.facts.slice(0, 3) : [],
        signalFamilies: Array.isArray(proof.signalFamilies) ? proof.signalFamilies.slice(0, 3) : [],
        diffs: Array.isArray(proof.diffs) ? proof.diffs.slice(0, 2) : [],
      };
      continue;
    }

    compact[key] = value;
  }

  for (const windowKey of ['baseline7d', 'baseline30d', 'response1d', 'response7d', 'response30d']) {
    const compactWindow = compactMetricsWindow(row[windowKey]);
    if (compactWindow) {
      compact[windowKey] = compactWindow;
    }
  }

  return compact;
}

function compactPreparedResult(result: unknown, maxRows: number): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  const typedResult = result as ResultWithData;
  const compact: Record<string, unknown> = {};

  for (const key of [
    'success',
    'error',
    'ranking_metric',
    'ranking_label',
    'ranking_definition',
    'timeframe',
    'timeframe_label',
    'window_start',
    'window_end',
    'trend_type',
    'pattern',
    'total_found',
    'filters_applied',
    'required_answer_fields',
    'response_guidance',
    'selected_change_surface',
    'sufficient_to_answer',
    'sufficiency_reason',
    'phase1_contract',
    'presentation_hints',
    'answer_payload',
    'meta',
  ]) {
    if (typedResult[key] != null) {
      compact[key] = typedResult[key];
    }
  }

  if (Array.isArray(typedResult.data)) {
    compact.data = typedResult.data.slice(0, maxRows).map((row) => compactRow(row));
  }

  if (Array.isArray(typedResult.results)) {
    compact.results = typedResult.results.slice(0, maxRows).map((row) => compactRow(row));
  }

  if (Array.isArray(typedResult.candidates)) {
    compact.candidates = typedResult.candidates.slice(0, Math.min(maxRows, 5)).map((row) => compactRow(row));
  }

  if (Array.isArray(typedResult.events)) {
    compact.events = typedResult.events.slice(0, Math.min(maxRows, 8)).map((event) => compactRow(event as Record<string, unknown>));
  }

  if (typedResult.app && typeof typedResult.app === 'object' && !Array.isArray(typedResult.app)) {
    compact.app = compactRow(typedResult.app);
  }

  if (typedResult.detail && typeof typedResult.detail === 'object' && !Array.isArray(typedResult.detail)) {
    compact.detail = compactRow(typedResult.detail);
  }

  if (typedResult.reference && typeof typedResult.reference === 'object' && !Array.isArray(typedResult.reference)) {
    compact.reference = typedResult.reference;
  }

  return compact;
}

export function formatResultForModel(
  result: unknown,
  options: FormatResultOptions = {}
): string {
  const prepared = prepareResultWithEntityLinks(result);
  const maxRows = Math.max(1, Math.min(options.maxRows ?? 10, 10));

  if (!options.compact) {
    return JSON.stringify(prepared);
  }

  return JSON.stringify(compactPreparedResult(prepared, maxRows));
}

export function formatResultWithEntityLinks(result: unknown): string {
  return formatResultForModel(result);
}
