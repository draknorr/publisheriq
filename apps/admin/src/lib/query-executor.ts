import type { QueryResult } from './llm/types';

// Dangerous SQL keywords that indicate non-SELECT operations
const BLOCKED_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'CALL',
  'COPY',
  'VACUUM',
  'ANALYZE',
  'LOCK',
  'UNLISTEN',
  'NOTIFY',
  'LISTEN',
  'RESET',
  'SET',
  'DECLARE',
  'FETCH',
  'MOVE',
  'CLOSE',
  'PREPARE',
  'DEALLOCATE',
];

// Patterns that indicate SQL injection attempts
const DANGEROUS_PATTERNS = [
  /--/, // SQL comments
  /;(?!\s*$)/, // Semicolons not at end (multiple statements)
  /\/\*/, // Block comment start
  /\*\//, // Block comment end
  /\bexec\s*\(/i, // EXEC function calls
  /\bpg_/i, // PostgreSQL system functions
  /\binformation_schema\b/i, // Information schema access
  /\bpg_catalog\b/i, // System catalog access
];

const MAX_ROWS = 50;
const MAX_QUERY_LENGTH = 5000;

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedSql?: string;
}

export function validateQuery(sql: string): ValidationResult {
  // Check query length
  if (sql.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: 'Query too long (max 5000 characters)' };
  }

  // Normalize whitespace for checking
  const normalizedSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();

  // Must start with SELECT
  if (!normalizedSql.startsWith('SELECT')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }

  // Check for blocked keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    // Use word boundary to avoid false positives (e.g., "CREATED_AT")
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSql)) {
      return { valid: false, error: `Forbidden keyword: ${keyword}` };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      return { valid: false, error: 'Query contains forbidden pattern' };
    }
  }

  // Sanitize the query
  let sanitizedSql = sql.trim();

  // Always remove trailing semicolon (causes syntax error in subquery wrapper)
  sanitizedSql = sanitizedSql.replace(/;\s*$/, '');

  // Ensure LIMIT exists, add if missing
  if (!/\bLIMIT\s+\d+/i.test(sanitizedSql)) {
    sanitizedSql += ` LIMIT ${MAX_ROWS}`;
  } else {
    // Ensure existing LIMIT doesn't exceed MAX_ROWS
    const limitMatch = sanitizedSql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const existingLimit = parseInt(limitMatch[1], 10);
      if (existingLimit > MAX_ROWS) {
        sanitizedSql = sanitizedSql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${MAX_ROWS}`);
      }
    }
  }

  return { valid: true, sanitizedSql };
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  // Validate the query
  const validation = validateQuery(sql);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const sanitizedSql = validation.sanitizedSql!;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error: 'Database not configured',
      };
    }

    // Execute via RPC function using REST API directly
    // This avoids type issues since the function may not be in generated types yet
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_readonly_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ query_text: sanitizedSql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Database error: ${errorText}`,
      };
    }

    const data = await response.json();

    // Handle null/empty results
    const rows = Array.isArray(data) ? data : [];
    const truncated = rows.length >= MAX_ROWS;

    return {
      success: true,
      data: rows.slice(0, MAX_ROWS) as Record<string, unknown>[],
      rowCount: rows.length,
      truncated,
      debug: {
        executedSql: sanitizedSql,
      },
    };
  } catch (error) {
    console.error('Query execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
