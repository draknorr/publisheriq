import 'server-only';

import { getServiceSupabase } from './supabase-service';
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
const BLOCKED_RELATION_PATTERNS = [
  /\buser_profiles\b/i,
  /\bwaitlist\b/i,
  /\bcredit_transactions\b/i,
  /\bcredit_reservations\b/i,
  /\brate_limit_state\b/i,
  /\bchat_query_logs\b/i,
  /\buser_pins\b/i,
  /\buser_alerts\b/i,
  /\buser_alert_preferences\b/i,
  /\buser_pin_alert_settings\b/i,
  /\balert_detection_state\b/i,
  /\bauth\./i,
  /\bstorage\./i,
];

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

  for (const pattern of BLOCKED_RELATION_PATTERNS) {
    if (pattern.test(sql)) {
      return { valid: false, error: 'Query references a restricted table or schema' };
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

  // Add default ORDER BY for game queries if missing
  if (!/\bORDER\s+BY\b/i.test(sanitizedSql)) {
    // Only add if query involves the apps table
    if (/\bFROM\s+apps\b/i.test(sanitizedSql) || /\ba\.appid\b/i.test(sanitizedSql)) {
      // Insert before LIMIT clause
      sanitizedSql = sanitizedSql.replace(
        /(\s+LIMIT\s+\d+)/i,
        ' ORDER BY a.release_date DESC NULLS LAST$1'
      );
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
    const supabase = getServiceSupabase();

    // Use the service-role client from the server so the RPC is no longer callable
    // through the public anon REST surface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('execute_readonly_query', {
      query_text: sanitizedSql,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

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
