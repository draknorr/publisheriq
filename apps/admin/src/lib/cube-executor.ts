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

// Map SQL operators to Cube.dev operators
const OPERATOR_MAP: Record<string, string> = {
  '>=': 'gte',
  '>': 'gt',
  '<=': 'lte',
  '<': 'lt',
  '=': 'equals',
  '==': 'equals',
  '!=': 'notEquals',
  '<>': 'notEquals',
};

const VALID_OPERATORS = ['equals', 'notEquals', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte', 'set', 'notSet'];

// Regex to extract SQL operators that might be combined with values (e.g., ">=90")
const SQL_OP_WITH_VALUE = /^(>=|<=|!=|<>|>|<|={1,2})(.+)$/;

/**
 * Normalize filters by converting SQL operators to Cube.dev operators
 * Handles various malformed inputs from LLMs
 */
function normalizeFilters(filters: CubeFilter[]): CubeFilter[] {
  console.log('[Cube] Raw filters received:', JSON.stringify(filters));

  return filters.map(filter => {
    let operator = filter.operator?.trim() || '';
    let values = filter.values || [];

    // Check if operator contains a value (e.g., ">=90")
    const match = operator.match(SQL_OP_WITH_VALUE);
    if (match) {
      const [, op, val] = match;
      operator = op;
      // Add extracted value if values array is empty
      if (values.length === 0 && val) {
        const numVal = Number(val);
        values = [isNaN(numVal) ? val : numVal];
      }
      console.log(`[Cube] Extracted operator "${op}" and value "${val}" from "${filter.operator}"`);
    }

    // Map SQL operator to Cube operator
    const normalizedOp = OPERATOR_MAP[operator] || operator;

    if (!VALID_OPERATORS.includes(normalizedOp)) {
      console.warn(`[Cube] Unknown filter operator: ${filter.operator} -> ${normalizedOp}`);
    }

    return {
      ...filter,
      operator: normalizedOp,
      values,
    };
  });
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
  success: boolean;
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
    cubeQuery.filters = normalizeFilters(query.filters);
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
        success: false,
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
      success: true,
      data: simplifiedData,
      rowCount: simplifiedData.length,
      cached: result.query?.hitPreAggregations || false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
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
