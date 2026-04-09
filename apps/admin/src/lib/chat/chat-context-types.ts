export type ChatEntityKind =
  | 'game'
  | 'publisher'
  | 'developer'
  | 'tag'
  | 'genre'
  | 'category'
  | 'change_activity';

export type SessionSelectionEntityKind = 'game' | 'publisher' | 'developer';
export type SessionSelectionMatchQuality = 'exact' | 'prefix' | 'substring' | 'fuzzy';
export type SessionSelectionMatchSource =
  | 'platform_entity_id'
  | 'canonical_name'
  | 'normalized_name'
  | 'alias'
  | 'normalized_alias'
  | 'legacy_name';
export type SessionSelectionResolutionTier =
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
export type SessionCandidateKind = 'games' | 'publishers' | 'developers' | 'activities';
export type SessionResultSetItemKind = 'games' | 'activities';
export type SessionRequestStateFamily = 'entity_ranking' | 'momentum_discovery';
export type SessionMomentumPromptFamily =
  | 'accelerating'
  | 'breaking_out'
  | 'current_players'
  | 'declining'
  | 'review_activity_down'
  | 'review_activity_up'
  | 'review_momentum'
  | 'review_sentiment_down'
  | 'review_sentiment_up'
  | 'trending';

export type Phase1FallbackAction =
  | 'respond'
  | 'ask_clarification'
  | 'answer_no_match'
  | 'retry_relaxed_once'
  | 'fetch_one_supporting_detail';

export type ChatQualityFlag =
  | 'context_applied'
  | 'terminal_result'
  | 'clarification_required'
  | 'no_match'
  | 'sparse_result'
  | 'temporary_unavailable'
  | 'fallback_allowed'
  | 'fallback_used'
  | 'duplicate_tool_blocked'
  | 'redundant_tool_blocked'
  | 'trend_scaffold'
  | 'change_scaffold'
  | 'iteration_limit';

export interface SessionChatEntity {
  kind: ChatEntityKind;
  name: string;
  entityUid?: string;
  id?: number | string;
  platform?: string;
  platformEntityId?: string;
  confidence?: 'high' | 'medium' | 'low';
  sourceTool: string;
}

export interface SessionChatConstraint {
  key: string;
  label: string;
  value: string;
  sourceTool: string;
}

export interface SessionChatCandidateSet {
  entityUids?: string[];
  kind: SessionCandidateKind;
  sourceTool: string;
  ids: Array<number | string>;
  names: string[];
  totalFound?: number;
  rationale?: string;
}

export interface SessionChatLastAnswer {
  family?: string;
  summary: string;
  noMatch?: boolean;
  sparse?: boolean;
  clarificationNeeded?: boolean;
  fallbackAction?: Phase1FallbackAction;
}

export interface SessionChatSelectionCandidate {
  displayName: string;
  entityKind: SessionSelectionEntityKind;
  entityUid: string;
  matchQuality: SessionSelectionMatchQuality | null;
  matchSource?: SessionSelectionMatchSource | null;
  ordinal: number;
  platform: string;
  platformEntityId: string | null;
  releaseYear?: number | null;
  resolutionTier?: SessionSelectionResolutionTier | null;
  score: number;
  totalReviews?: number | null;
}

export interface SessionChatSelectionSlot {
  candidates: SessionChatSelectionCandidate[];
  continuationToken?: string | null;
  expectedEntityKind?: SessionSelectionEntityKind | null;
  label: string;
  query: string;
  requiresClarification: boolean;
  selectedEntityUid: string | null;
  slotId: string;
  totalCandidates?: number | null;
}

export interface SessionChatSelectionState {
  family: string;
  slots: SessionChatSelectionSlot[];
}

export interface SessionChatRequestPreviewItem {
  entityUid?: string | null;
  label: string;
  ordinal: number;
  platformEntityId?: number | string | null;
}

export interface SessionChatRequestState {
  canonicalArgs: object;
  contractName: 'discoverMomentum' | 'rankEntities';
  entityKind?: SessionSelectionEntityKind | null;
  family: SessionRequestStateFamily;
  metric?: string | null;
  momentumPromptFamily?: SessionMomentumPromptFamily | null;
  previewItems: SessionChatRequestPreviewItem[];
  timeframe?: '7d' | '30d' | 'current' | null;
  trendType?: 'accelerating' | 'breaking_out' | 'declining' | 'review_momentum' | null;
  updatedAt: string;
}

export interface SessionChatResultSet {
  continuationToken?: string | null;
  family: string;
  sourceTool: string;
  sourceContract?: 'discoverMomentum' | 'searchCatalog' | 'semanticSearch';
  itemKind: SessionResultSetItemKind;
  sourceArgs: Record<string, unknown>;
  shownIds: Array<number | string>;
  lastPageSize: number;
  totalFound?: number | null;
  continuable: boolean;
  updatedAt: string;
}

export interface SessionChatContext {
  version: 1;
  entities: SessionChatEntity[];
  constraints: SessionChatConstraint[];
  candidateSet?: SessionChatCandidateSet | null;
  selectionState?: SessionChatSelectionState | null;
  requestState?: SessionChatRequestState | null;
  resultSet?: SessionChatResultSet | null;
  lastAnswer?: SessionChatLastAnswer | null;
  updatedAt: string;
}

export interface ToolAnswerContractSummary {
  family: string;
  resultShape?: string;
  sufficientToAnswer: boolean;
  needsClarification: boolean;
  noMatch: boolean;
  sparse: boolean;
  unavailable?: boolean;
  failureKind?: string;
  fallbackAllowed: boolean;
  fallbackAction: Phase1FallbackAction;
  requiredAnswerFields: string[];
  supportingEvidence: string[];
  answerScaffold?: string;
  summary: string;
  qualityFlags: ChatQualityFlag[];
}

export interface GuardrailTraceEntry {
  step: string;
  decision: 'allow' | 'block' | 'observe';
  toolName?: string;
  reason: string;
}

export interface ChatTurnQualityInfo {
  family?: string;
  qualityFlags: ChatQualityFlag[];
  fallbackUsed: boolean;
  contextApplied: boolean;
  guardrailTrace: GuardrailTraceEntry[];
  terminalContract?: ToolAnswerContractSummary | null;
  renderMode?: 'model' | 'deterministic';
  terminalAfterIteration?: number | null;
  modelHistoryChars?: number;
  continuationDetected?: boolean;
  continuationIntent?: 'continue' | 'continue_with_limit' | 'continue_with_constraint_delta';
  continuationSourceTool?: string;
  requestedCount?: number;
  excludedCount?: number;
  continuationExhausted?: boolean;
}
