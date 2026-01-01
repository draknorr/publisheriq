/**
 * Cube.dev Query Executor
 *
 * Executes queries against the Cube.dev semantic layer
 * and returns formatted results for the LLM.
 */

import jwt from 'jsonwebtoken';

interface CubeFilter {
  member: string;
  operator: string;
  values?: (string | number | boolean)[];
}

interface CubeQuery {
  cube: string;
  dimensions?: string[];
  measures?: string[];
  filters?: CubeFilter[];
  segments?: string[];
  order?: Record<string, 'asc' | 'desc'>;
  limit?: number;
}

interface CubeResult {
  data: Record<string, unknown>[];
  rowCount: number;
  cached?: boolean;
  error?: string;
}

/**
 * Generate a JWT token for Cube.dev API authentication
 */
function generateToken(): string {
  const secret = process.env.CUBE_API_SECRET;
  if (!secret) {
    throw new Error('CUBE_API_SECRET environment variable is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: 'publisheriq-admin',
      iat: now,
      exp: now + 3600, // 1 hour
    },
    secret,
    { algorithm: 'HS256' }
  );
}

/**
 * Execute a Cube.dev query
 */
export async function executeCubeQuery(query: CubeQuery): Promise<CubeResult> {
  const apiUrl = process.env.CUBE_API_URL;

  if (!apiUrl) {
    throw new Error('CUBE_API_URL environment variable is not set');
  }

  // Build the Cube.dev query format
  const cubeQuery: Record<string, unknown> = {};

  if (query.dimensions && query.dimensions.length > 0) {
    cubeQuery.dimensions = query.dimensions;
  }

  if (query.measures && query.measures.length > 0) {
    cubeQuery.measures = query.measures;
  }

  if (query.filters && query.filters.length > 0) {
    cubeQuery.filters = query.filters;
  }

  if (query.segments && query.segments.length > 0) {
    cubeQuery.segments = query.segments;
  }

  if (query.order) {
    cubeQuery.order = query.order;
  }

  if (query.limit) {
    cubeQuery.limit = Math.min(query.limit, 100); // Cap at 100
  } else {
    cubeQuery.limit = 50; // Default limit
  }

  try {
    const token = generateToken();

    const response = await fetch(`${apiUrl}/cubejs-api/v1/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: cubeQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: [],
        rowCount: 0,
        error: `Cube.dev query failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    // Extract data and format for LLM
    const data = result.data || [];

    // Simplify field names (remove Cube prefix)
    const simplifiedData = data.map((row: Record<string, unknown>) => {
      const simplified: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        // Remove cube prefix: "Discovery.name" -> "name"
        const simplifiedKey = key.includes('.') ? key.split('.').pop()! : key;
        simplified[simplifiedKey] = value;
      }
      return simplified;
    });

    return {
      data: simplifiedData,
      rowCount: simplifiedData.length,
      cached: result.query?.hitPreAggregations || false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: [],
      rowCount: 0,
      error: `Cube.dev query error: ${message}`,
    };
  }
}

/**
 * Check if Cube.dev is available
 */
export async function isCubeAvailable(): Promise<boolean> {
  const apiUrl = process.env.CUBE_API_URL;
  if (!apiUrl) return false;

  try {
    const response = await fetch(`${apiUrl}/readyz`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
