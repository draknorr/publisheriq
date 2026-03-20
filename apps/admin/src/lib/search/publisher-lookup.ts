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
import type { ToolSufficiencyMetadata } from '@/lib/llm/types';

interface LookupCompanyCandidate {
  id: number;
  name: string;
  matchKind: CompanyResolutionCandidate['matchKind'];
  resolutionScore: number;
}

interface CanonicalCompanySummary {
  gameCount?: number;
  totalReviews?: number;
  avgReviewScore?: number;
  positiveReviews?: number;
}

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
  result_shape?: ToolSufficiencyMetadata['result_shape'];
  sufficient_to_answer?: boolean;
  sufficiency_reason?: string;
  success: boolean;
  entityType: 'publisher';
  query: string;
  results: LookupCompanyCandidate[];
  canonicalResult?: {
    id: number;
    name: string;
    confidence: ResolutionConfidence;
  };
  summary?: CanonicalCompanySummary;
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
  result_shape?: ToolSufficiencyMetadata['result_shape'];
  sufficient_to_answer?: boolean;
  sufficiency_reason?: string;
  success: boolean;
  entityType: 'developer';
  query: string;
  results: LookupCompanyCandidate[];
  canonicalResult?: {
    id: number;
    name: string;
    confidence: ResolutionConfidence;
  };
  summary?: CanonicalCompanySummary;
  resolutionConfidence?: ResolutionConfidence;
  needsDisambiguation?: boolean;
  error?: string;
}

function summarizeCandidate(candidate?: CompanyResolutionCandidate): CanonicalCompanySummary | undefined {
  if (!candidate) {
    return undefined;
  }

  return {
    gameCount: candidate.gameCount,
    totalReviews: candidate.totalReviews,
    avgReviewScore: candidate.avgReviewScore,
    positiveReviews: candidate.positiveReviews,
  };
}

function stripCandidate(candidate: CompanyResolutionCandidate): LookupCompanyCandidate {
  return {
    id: candidate.id,
    name: candidate.name,
    matchKind: candidate.matchKind,
    resolutionScore: candidate.resolutionScore,
  };
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
      result_shape: 'lookup',
      sufficient_to_answer: true,
      sufficiency_reason: 'The company lookup needs a non-empty query before any follow-up tool calls.',
      success: false,
      entityType,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  try {
    const resolution = await resolveCompanyReference(entityType, query, limit);
    const canonicalCandidate = resolution.canonicalResult
      ? resolution.results.find((candidate) => candidate.id === resolution.canonicalResult?.id)
      : undefined;

    return {
      result_shape: 'lookup',
      success: resolution.success,
      entityType,
      query,
      results: resolution.results.map(stripCandidate),
      canonicalResult: resolution.canonicalResult,
      summary: summarizeCandidate(canonicalCandidate),
      resolutionConfidence: resolution.resolutionConfidence,
      needsDisambiguation: resolution.needsDisambiguation,
      sufficient_to_answer: resolution.needsDisambiguation || !resolution.success ? true : false,
      sufficiency_reason: resolution.needsDisambiguation
        ? resolution.error ?? `The ${entityType} name "${query}" is ambiguous and needs clarification.`
        : resolution.success
          ? 'Identity resolved only. For company counts, rankings, comparisons, or top-title answers, run one analytics query before responding.'
          : resolution.error,
      error: resolution.error,
    };
  } catch (error) {
    if (entityType === 'publisher') {
      return {
        result_shape: 'lookup',
        sufficient_to_answer: true,
        sufficiency_reason: error instanceof Error ? error.message : 'Failed to lookup publishers',
        success: false,
        entityType,
        query,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to lookup publishers',
      };
    }

    return {
      result_shape: 'lookup',
      sufficient_to_answer: true,
      sufficiency_reason: error instanceof Error ? error.message : 'Failed to lookup developers',
      success: false,
      entityType,
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to lookup developers',
    };
  }
}
