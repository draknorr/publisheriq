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
  [key: string]: unknown;
}

/**
 * Format a single data row with entity links
 */
function formatRowWithLinks(row: Record<string, unknown>): Record<string, unknown> {
  const formatted = { ...row };

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
    const formatted = { ...item };
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

/**
 * Format tool result with entity links before sending to LLM
 *
 * Transforms raw tool results to include markdown entity links,
 * ensuring the LLM can pass them through directly without needing
 * to construct links itself.
 */
export function formatResultWithEntityLinks(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return JSON.stringify(result);
  }

  const typedResult = result as ResultWithData;

  // Handle unsuccessful results - return as-is
  if (typedResult.success === false) {
    return JSON.stringify(result);
  }

  // Handle query_analytics and search_games results (have 'data' array)
  if (Array.isArray(typedResult.data) && typedResult.data.length > 0) {
    const formattedData = typedResult.data.map((row) =>
      formatRowWithLinks(row as Record<string, unknown>)
    );

    return JSON.stringify({ ...typedResult, data: formattedData });
  }

  // Handle find_similar results (have 'results' array with 'type' field)
  if (Array.isArray(typedResult.results) && typedResult.results.length > 0) {
    const formattedResults = formatSimilarityResults(
      typedResult.results as Record<string, unknown>[]
    );
    return JSON.stringify({ ...typedResult, results: formattedResults });
  }

  // No data to format - return as-is
  return JSON.stringify(result);
}
