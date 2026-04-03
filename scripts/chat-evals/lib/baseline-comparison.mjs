import fs from 'node:fs/promises';
import path from 'node:path';

import { formatLatencyMs } from './blended-persona-scoring.mjs';
import { summarizeTraceEntries } from './tool-backend-audit.mjs';

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function averageOf(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

function dependencyStateForTraceSummary(summary) {
  if (!summary?.captured) {
    return 'unknown';
  }

  return summary.stillDependsOnLegacyAnswerPath ? 'legacy' : 'tiger_only';
}

function summarizeDependencyState(result) {
  const traceSummary = summarizeTraceEntries(result?.diagnostics?.executionTrace);

  return {
    dependencyState: dependencyStateForTraceSummary(traceSummary),
    traceSummary,
  };
}

function scoreDelta(currentValue, baselineValue) {
  if (typeof currentValue !== 'number' || typeof baselineValue !== 'number') {
    return null;
  }

  return roundToTenth(currentValue - baselineValue);
}

function latencyDelta(currentValue, baselineValue) {
  if (typeof currentValue !== 'number' || typeof baselineValue !== 'number') {
    return null;
  }

  return currentValue - baselineValue;
}

function buildPromptComparisonRow(currentResult, baselineResult) {
  const currentDependency = summarizeDependencyState(currentResult);
  const baselineDependency = summarizeDependencyState(baselineResult);
  const currentLatencyMs = currentResult?.visibleLatencyMs ?? currentResult?.latencyMs ?? null;
  const baselineLatencyMs = baselineResult?.visibleLatencyMs ?? baselineResult?.latencyMs ?? null;

  return {
    critiqueId: currentResult.critiqueId,
    prompt: currentResult.prompt,
    family: currentResult.family,
    section: currentResult.section,
    current: {
      dependencyState: currentDependency.dependencyState,
      draftScore: currentResult.draftScore ?? null,
      executedContracts: currentDependency.traceSummary.executedContracts,
      executedTools: currentDependency.traceSummary.executedTools,
      latencyMs: currentLatencyMs,
      latencyText: formatLatencyMs(currentLatencyMs),
      legacyBackends: currentDependency.traceSummary.legacyBackends,
      legacyNames: currentDependency.traceSummary.legacyNames,
      migrationDispositions: currentDependency.traceSummary.migrationDispositions,
      recommendedTigerContracts: currentDependency.traceSummary.recommendedTigerContracts,
      routeSummary: currentResult.routeSummary ?? null,
      status: currentResult.status ?? null,
      tigerOnly: currentDependency.dependencyState === 'tiger_only',
      traceCaptured: currentDependency.traceSummary.captured,
      verdict: currentResult.verdict ?? null,
    },
    baseline: baselineResult
      ? {
          dependencyState: baselineDependency.dependencyState,
          draftScore: baselineResult.draftScore ?? null,
          executedContracts: baselineDependency.traceSummary.executedContracts,
          executedTools: baselineDependency.traceSummary.executedTools,
          latencyMs: baselineLatencyMs,
          latencyText: formatLatencyMs(baselineLatencyMs),
          legacyBackends: baselineDependency.traceSummary.legacyBackends,
          legacyNames: baselineDependency.traceSummary.legacyNames,
          migrationDispositions: baselineDependency.traceSummary.migrationDispositions,
          recommendedTigerContracts: baselineDependency.traceSummary.recommendedTigerContracts,
          routeSummary: baselineResult.routeSummary ?? null,
          status: baselineResult.status ?? null,
          tigerOnly: baselineDependency.dependencyState === 'tiger_only',
          traceCaptured: baselineDependency.traceSummary.captured,
          verdict: baselineResult.verdict ?? null,
        }
      : null,
    comparison: {
      latencyDeltaMs: latencyDelta(currentLatencyMs, baselineLatencyMs),
      routeChanged:
        baselineResult != null
          ? (currentResult.routeSummary ?? null) !== (baselineResult.routeSummary ?? null)
          : null,
      scoreDelta: scoreDelta(currentResult.draftScore, baselineResult?.draftScore),
      statusChanged:
        baselineResult != null ? (currentResult.status ?? null) !== (baselineResult.status ?? null) : null,
      verdictChanged:
        baselineResult != null ? (currentResult.verdict ?? null) !== (baselineResult.verdict ?? null) : null,
    },
  };
}

function buildScenarioTurnComparison(currentTurn, baselineTurn, scenarioId) {
  const currentDependency = summarizeDependencyState(currentTurn);
  const baselineDependency = summarizeDependencyState(baselineTurn);
  const currentLatencyMs = currentTurn?.visibleLatencyMs ?? currentTurn?.latencyMs ?? null;
  const baselineLatencyMs = baselineTurn?.visibleLatencyMs ?? baselineTurn?.latencyMs ?? null;

  return {
    itemId: `${scenarioId}:turn:${currentTurn.turnIndex}`,
    turnIndex: currentTurn.turnIndex,
    userPrompt: currentTurn.userPrompt,
    current: {
      dependencyState: currentDependency.dependencyState,
      draftScore: currentTurn.autoScore ?? null,
      latencyMs: currentLatencyMs,
      legacyBackends: currentDependency.traceSummary.legacyBackends,
      legacyNames: currentDependency.traceSummary.legacyNames,
      routeSummary: currentTurn.routeSummary ?? null,
      status: currentTurn.status ?? null,
      tigerOnly: currentDependency.dependencyState === 'tiger_only',
      traceCaptured: currentDependency.traceSummary.captured,
      verdict: currentTurn.autoVerdict ?? null,
    },
    baseline: baselineTurn
      ? {
          dependencyState: baselineDependency.dependencyState,
          draftScore: baselineTurn.autoScore ?? null,
          latencyMs: baselineLatencyMs,
          legacyBackends: baselineDependency.traceSummary.legacyBackends,
          legacyNames: baselineDependency.traceSummary.legacyNames,
          routeSummary: baselineTurn.routeSummary ?? null,
          status: baselineTurn.status ?? null,
          tigerOnly: baselineDependency.dependencyState === 'tiger_only',
          traceCaptured: baselineDependency.traceSummary.captured,
          verdict: baselineTurn.autoVerdict ?? null,
        }
      : null,
    comparison: {
      latencyDeltaMs: latencyDelta(currentLatencyMs, baselineLatencyMs),
      routeChanged:
        baselineTurn != null
          ? (currentTurn.routeSummary ?? null) !== (baselineTurn.routeSummary ?? null)
          : null,
      scoreDelta: scoreDelta(currentTurn.autoScore, baselineTurn?.autoScore),
      statusChanged:
        baselineTurn != null ? (currentTurn.status ?? null) !== (baselineTurn.status ?? null) : null,
      verdictChanged:
        baselineTurn != null ? (currentTurn.autoVerdict ?? null) !== (baselineTurn.autoVerdict ?? null) : null,
    },
  };
}

function buildScenarioComparisonRow(currentResult, baselineResult) {
  const baselineTurnsByIndex = new Map(
    coerceArray(baselineResult?.turns).map((turn) => [turn.turnIndex, turn])
  );
  const turnComparisons = coerceArray(currentResult.turns).map((turn) =>
    buildScenarioTurnComparison(turn, baselineTurnsByIndex.get(turn.turnIndex) ?? null, currentResult.scenarioId)
  );

  return {
    scenarioId: currentResult.scenarioId,
    scenarioName: currentResult.scenarioName,
    current: {
      draftScore: currentResult.draftScore ?? null,
      status: currentResult.status ?? null,
      tigerOnlyTurnCount: turnComparisons.filter((turn) => turn.current.tigerOnly).length,
      unknownTurnCount: turnComparisons.filter((turn) => turn.current.dependencyState === 'unknown').length,
      verdict: currentResult.verdict ?? null,
    },
    baseline: baselineResult
      ? {
          draftScore: baselineResult.draftScore ?? null,
          status: baselineResult.status ?? null,
          tigerOnlyTurnCount: turnComparisons.filter((turn) => turn.baseline?.tigerOnly).length,
          unknownTurnCount: turnComparisons.filter((turn) => turn.baseline?.dependencyState === 'unknown').length,
          verdict: baselineResult.verdict ?? null,
        }
      : null,
    comparison: {
      scoreDelta: scoreDelta(currentResult.draftScore, baselineResult?.draftScore),
      statusChanged:
        baselineResult != null ? (currentResult.status ?? null) !== (baselineResult.status ?? null) : null,
      verdictChanged:
        baselineResult != null ? (currentResult.verdict ?? null) !== (baselineResult.verdict ?? null) : null,
    },
    turns: turnComparisons,
  };
}

function buildNonTigerPrompts(promptComparisons) {
  return promptComparisons
    .filter((row) => row.current.dependencyState !== 'tiger_only')
    .map((row) => ({
      critiqueId: row.critiqueId,
      dependencyState: row.current.dependencyState,
      prompt: row.prompt,
      currentDraftScore: row.current.draftScore,
      baselineDraftScore: row.baseline?.draftScore ?? null,
      scoreDelta: row.comparison.scoreDelta,
      currentLatencyMs: row.current.latencyMs,
      baselineLatencyMs: row.baseline?.latencyMs ?? null,
      latencyDeltaMs: row.comparison.latencyDeltaMs,
      status: row.current.status,
      routeSummary: row.current.routeSummary,
      legacyBackends: row.current.legacyBackends,
      legacyTools: row.current.legacyNames,
      recommendedTigerContracts: row.current.recommendedTigerContracts,
      migrationDispositions: row.current.migrationDispositions,
      executedTools: row.current.executedTools,
      executedContracts: row.current.executedContracts,
    }));
}

function comparePriorityRows(left, right) {
  if ((left.dependencyState === 'unknown') !== (right.dependencyState === 'unknown')) {
    return left.dependencyState === 'unknown' ? -1 : 1;
  }

  if ((left.status === 'success') !== (right.status === 'success')) {
    return left.status === 'success' ? 1 : -1;
  }

  const leftScoreDelta = typeof left.scoreDelta === 'number' ? left.scoreDelta : 0;
  const rightScoreDelta = typeof right.scoreDelta === 'number' ? right.scoreDelta : 0;
  if (leftScoreDelta !== rightScoreDelta) {
    return leftScoreDelta - rightScoreDelta;
  }

  const leftScore = typeof left.currentDraftScore === 'number' ? left.currentDraftScore : Number.MAX_SAFE_INTEGER;
  const rightScore = typeof right.currentDraftScore === 'number' ? right.currentDraftScore : Number.MAX_SAFE_INTEGER;
  if (leftScore !== rightScore) {
    return leftScore - rightScore;
  }

  const leftLatencyDelta = typeof left.latencyDeltaMs === 'number' ? left.latencyDeltaMs : 0;
  const rightLatencyDelta = typeof right.latencyDeltaMs === 'number' ? right.latencyDeltaMs : 0;
  if (leftLatencyDelta !== rightLatencyDelta) {
    return rightLatencyDelta - leftLatencyDelta;
  }

  const leftLatency = typeof left.currentLatencyMs === 'number' ? left.currentLatencyMs : 0;
  const rightLatency = typeof right.currentLatencyMs === 'number' ? right.currentLatencyMs : 0;
  if (leftLatency !== rightLatency) {
    return rightLatency - leftLatency;
  }

  return String(left.critiqueId).localeCompare(String(right.critiqueId));
}

function buildMigrationPriority(nonTigerPrompts) {
  return [...nonTigerPrompts]
    .sort(comparePriorityRows)
    .map((row, index) => ({
      ...row,
      priorityRank: index + 1,
    }));
}

function buildComparisonSummary(params) {
  const { baselineDir, baselineLabel, promptComparisons, scenarioComparisons } = params;
  const matchedPromptRows = promptComparisons.filter((row) => row.baseline);
  const matchedScenarioRows = scenarioComparisons.filter((row) => row.baseline);
  const currentLegacyPrompts = promptComparisons.filter((row) => row.current.dependencyState === 'legacy').length;
  const currentTigerOnlyPrompts = promptComparisons.filter((row) => row.current.dependencyState === 'tiger_only').length;
  const currentUnknownPrompts = promptComparisons.filter((row) => row.current.dependencyState === 'unknown').length;
  const baselineLegacyPrompts = promptComparisons.filter((row) => row.baseline?.dependencyState === 'legacy').length;
  const baselineTigerOnlyPrompts = promptComparisons.filter((row) => row.baseline?.dependencyState === 'tiger_only').length;
  const baselineUnknownPrompts = promptComparisons.filter((row) => row.baseline?.dependencyState === 'unknown').length;
  const improvedPrompts = matchedPromptRows.filter((row) => (row.comparison.scoreDelta ?? 0) > 0).length;
  const regressedPrompts = matchedPromptRows.filter((row) => (row.comparison.scoreDelta ?? 0) < 0).length;
  const unchangedPrompts = matchedPromptRows.length - improvedPrompts - regressedPrompts;

  return {
    baselineDir,
    baselineLabel,
    baselineLegacyPrompts,
    baselineTigerOnlyPrompts,
    baselineUnknownPrompts,
    currentLegacyPrompts,
    currentTigerOnlyPrompts,
    currentUnknownPrompts,
    dependencyStateComplete: currentUnknownPrompts === 0,
    matchedPromptCount: matchedPromptRows.length,
    matchedScenarioCount: matchedScenarioRows.length,
    promptAverageScoreDelta: roundToTenth(
      averageOf(
        matchedPromptRows
          .map((row) => row.comparison.scoreDelta)
          .filter((value) => typeof value === 'number')
      )
    ),
    promptsImprovedCount: improvedPrompts,
    promptsRegressedCount: regressedPrompts,
    promptsUnchangedCount: unchangedPrompts,
    scenarioAverageScoreDelta: roundToTenth(
      averageOf(
        matchedScenarioRows
          .map((row) => row.comparison.scoreDelta)
          .filter((value) => typeof value === 'number')
      )
    ),
  };
}

function renderPromptBaselineComparisonMarkdown(params) {
  const { baselineComparison, migrationPriority, nonTigerPrompts, promptComparisons, runSummary } = params;
  const regressions = [...promptComparisons]
    .filter((row) => typeof row.comparison.scoreDelta === 'number' && row.comparison.scoreDelta < 0)
    .sort((left, right) => (left.comparison.scoreDelta ?? 0) - (right.comparison.scoreDelta ?? 0))
    .slice(0, 15);
  const improvements = [...promptComparisons]
    .filter((row) => typeof row.comparison.scoreDelta === 'number' && row.comparison.scoreDelta > 0)
    .sort((left, right) => (right.comparison.scoreDelta ?? 0) - (left.comparison.scoreDelta ?? 0))
    .slice(0, 15);

  const lines = [
    '# Prompt Baseline Comparison',
    '',
    `- Generated: ${runSummary.generatedAt}`,
    `- Current endpoint: ${runSummary.endpointOrigin || '-'}`,
    `- Current query API: ${runSummary.queryApiBaseUrl || '-'}${runSummary.queryApiSource ? ` (${runSummary.queryApiSource})` : ''}`,
    `- Baseline: ${baselineComparison.baselineLabel} (${baselineComparison.baselineDir})`,
    `- Matched prompts: ${baselineComparison.matchedPromptCount}`,
    `- Prompt average score delta: ${baselineComparison.promptAverageScoreDelta >= 0 ? '+' : ''}${baselineComparison.promptAverageScoreDelta}`,
    `- Current Tiger-only prompts: ${baselineComparison.currentTigerOnlyPrompts}`,
    `- Current legacy-dependent prompts: ${baselineComparison.currentLegacyPrompts}`,
    `- Current unknown-dependency prompts: ${baselineComparison.currentUnknownPrompts}`,
    '',
    '## Prompts Not Confirmed Tiger-only',
    '',
    '| Rank | Critique ID | Score | Delta | Latency | Legacy Tools | Legacy Backends | Recommended Tiger |',
    '|---:|---|---:|---:|---:|---|---|---|',
  ];

  for (const row of migrationPriority) {
    lines.push(
      `| ${row.priorityRank} | ${escapeTable(row.critiqueId)} | ${Number(row.currentDraftScore ?? 0).toFixed(1)} | ${typeof row.scoreDelta === 'number' ? `${row.scoreDelta >= 0 ? '+' : ''}${row.scoreDelta.toFixed(1)}` : '-'} | ${escapeTable(formatLatencyMs(row.currentLatencyMs) || '-')} | ${escapeTable(row.legacyTools.join(', ') || (row.dependencyState === 'unknown' ? 'unknown' : '-'))} | ${escapeTable(row.legacyBackends.join(', ') || (row.dependencyState === 'unknown' ? 'unknown' : '-'))} | ${escapeTable(row.recommendedTigerContracts.join(', ') || '-')} |`
    );
  }

  lines.push('', '## Biggest Regressions', '', '| Critique ID | Delta | Current Score | Legacy | Prompt |', '|---|---:|---:|---|---|');

  for (const row of regressions) {
    lines.push(
      `| ${escapeTable(row.critiqueId)} | ${row.comparison.scoreDelta?.toFixed(1)} | ${Number(row.current.draftScore ?? 0).toFixed(1)} | ${escapeTable(row.current.legacyNames.join(', ') || '-')} | ${escapeTable(row.prompt)} |`
    );
  }

  lines.push('', '## Biggest Improvements', '', '| Critique ID | Delta | Current Score | Tiger Only | Prompt |', '|---|---:|---:|---|---|');

  for (const row of improvements) {
    lines.push(
      `| ${escapeTable(row.critiqueId)} | ${row.comparison.scoreDelta?.toFixed(1)} | ${Number(row.current.draftScore ?? 0).toFixed(1)} | ${row.current.tigerOnly ? 'yes' : 'no'} | ${escapeTable(row.prompt)} |`
    );
  }

  if (nonTigerPrompts.length === 0 && baselineComparison.currentUnknownPrompts === 0) {
    lines.push('', 'All prompts are Tiger-only in the current run.');
  }

  return `${lines.join('\n')}\n`;
}

export async function buildBaselineComparisonArtifacts(params) {
  const baselineDir = params.baselineDir?.trim();
  if (!baselineDir) {
    return null;
  }

  const baselinePromptResults = JSON.parse(
    await fs.readFile(path.join(baselineDir, 'prompt-results.json'), 'utf8')
  );
  const baselineScenarioResults = JSON.parse(
    await fs.readFile(path.join(baselineDir, 'scenario-results.json'), 'utf8')
  );
  const baselineRunSummary = JSON.parse(
    await fs.readFile(path.join(baselineDir, 'run-summary.json'), 'utf8')
  );

  const baselinePromptsById = new Map(
    coerceArray(baselinePromptResults).map((result) => [String(result.critiqueId), result])
  );
  const baselineScenariosById = new Map(
    coerceArray(baselineScenarioResults).map((result) => [String(result.scenarioId), result])
  );

  const promptComparisons = coerceArray(params.promptResults).map((result) =>
    buildPromptComparisonRow(result, baselinePromptsById.get(String(result.critiqueId)) ?? null)
  );
  const scenarioComparisons = coerceArray(params.scenarioResults).map((result) =>
    buildScenarioComparisonRow(result, baselineScenariosById.get(String(result.scenarioId)) ?? null)
  );
  const nonTigerPrompts = buildNonTigerPrompts(promptComparisons);
  const migrationPriority = buildMigrationPriority(nonTigerPrompts);
  const baselineLabel = params.baselineLabel?.trim() || path.basename(baselineDir);
  const summary = buildComparisonSummary({
    baselineDir,
    baselineLabel,
    promptComparisons,
    scenarioComparisons,
  });

  return {
    baselineDir,
    baselineLabel,
    baselineRunSummary,
    migrationPriority,
    nonTigerPrompts,
    promptComparisons,
    promptComparisonMarkdown: renderPromptBaselineComparisonMarkdown({
      baselineComparison: summary,
      migrationPriority,
      nonTigerPrompts,
      promptComparisons,
      runSummary: params.runSummary,
    }),
    scenarioComparisons,
    summary,
  };
}
