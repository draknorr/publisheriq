/**
 * Publisher/Developer Lookup Service
 *
 * Provides canonical publisher and developer resolution for chat.
 */

import {
  resolveCompanyReference,
  type CompanyEntityType,
  type CompanyResolutionCandidate,
  type ResolutionConfidence,
} from '@/lib/search/company-resolution';

/**
 * Arguments for lookup_publishers tool
 */
export interface LookupPublishersArgs {
  query: string;
  limit?: number;
}

/**
 * Result from lookup_publishers
 */
export interface LookupPublishersResult {
  success: boolean;
  entityType: 'publisher';
  query: string;
  results: CompanyResolutionCandidate[];
  canonicalResult?: {
    id: number;
    name: string;
    confidence: ResolutionConfidence;
  };
  resolutionConfidence?: ResolutionConfidence;
  needsDisambiguation?: boolean;
  error?: string;
}

/**
 * Search for matching publisher names using the canonical company resolver
 */
export async function lookupPublishers(args: LookupPublishersArgs): Promise<LookupPublishersResult> {
  return lookupCompany('publisher', args) as Promise<LookupPublishersResult>;
}

/**
 * Arguments for lookup_developers tool
 */
export interface LookupDevelopersArgs {
  query: string;
  limit?: number;
}

/**
 * Result from lookup_developers
 */
export interface LookupDevelopersResult {
  success: boolean;
  entityType: 'developer';
  query: string;
  results: CompanyResolutionCandidate[];
  canonicalResult?: {
    id: number;
    name: string;
    confidence: ResolutionConfidence;
  };
  resolutionConfidence?: ResolutionConfidence;
  needsDisambiguation?: boolean;
  error?: string;
}

/**
 * Search for matching developer names using the canonical company resolver
 */
export async function lookupDevelopers(args: LookupDevelopersArgs): Promise<LookupDevelopersResult> {
  return lookupCompany('developer', args) as Promise<LookupDevelopersResult>;
}

async function lookupCompany(
  entityType: CompanyEntityType,
  args: LookupPublishersArgs | LookupDevelopersArgs
): Promise<LookupPublishersResult | LookupDevelopersResult> {
  const { query, limit = 10 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      entityType,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  try {
    const resolution = await resolveCompanyReference(entityType, query, limit);
    return {
      success: resolution.success,
      entityType,
      query,
      results: resolution.results,
      canonicalResult: resolution.canonicalResult,
      resolutionConfidence: resolution.resolutionConfidence,
      needsDisambiguation: resolution.needsDisambiguation,
      error: resolution.error,
    };
  } catch (error) {
    if (entityType === 'publisher') {
      return {
        success: false,
        entityType,
        query,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to lookup publishers',
      };
    }

    return {
      success: false,
      entityType,
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to lookup developers',
    };
  }
}
