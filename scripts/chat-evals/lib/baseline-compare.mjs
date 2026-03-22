import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BLESSED_BASELINES_PATH = path.join(ROOT, 'scripts', 'chat-evals', 'blessed-baselines.json');
const LEDGER_PATHS = [
  path.join(ROOT, 'docs', 'chat-prompt-evals.md'),
  path.join(ROOT, 'docs', 'chat-prompt-evals-round-2.md'),
];

export async function loadBaselineBundle({ baselineMode, pack, prompts }) {
  if (baselineMode === 'none') {
    return null;
  }

  if (baselineMode === 'blessed') {
    return loadBlessedBaselineBundle(pack.area, prompts);
  }

  if (baselineMode === 'latest') {
    return findLatestBaselineBundle(prompts);
  }

  throw new Error(`Unsupported baseline mode: ${baselineMode}`);
}

export async function buildPackComparison({ pack, curationEntries, baselineBundle }) {
  const baselineDefaults = await loadBaselineDefaults();
  if (!baselineBundle) {
    return {
      status: 'no_baseline',
      packKey: pack.packKey,
      packLabel: pack.label,
      packType: pack.packType,
      source: null,
      budgets: baselineDefaults,
      message: 'No baseline selected for this pack.',
      promptCount: curationEntries.length,
      scoredPromptCount: countScoredEntries(curationEntries),
      violations: [],
      regressions: [],
    };
  }

  const baselineByPrompt = new Map(baselineBundle.entries.map((entry) => [entry.prompt, entry]));
  const rows = curationEntries.map((entry) => ({
    current: entry,
    baseline: baselineByPrompt.get(entry.prompt) || null,
  }));
  const missingBaselinePrompts = rows.filter((row) => !row.baseline).map((row) => row.current.prompt);
  const scoredRows = rows.filter((row) => isFiniteNumber(row.current.score));

  if (scoredRows.length !== rows.length) {
    return {
      status: 'awaiting_curation',
      packKey: pack.packKey,
      packLabel: pack.label,
      packType: pack.packType,
      source: baselineBundle.source,
      budgets: baselineDefaults,
      message: 'Comparison is waiting on manual curation scores for this run.',
      promptCount: rows.length,
      scoredPromptCount: scoredRows.length,
      missingBaselinePrompts,
      violations: [],
      regressions: [],
    };
  }

  const comparableRows = rows.filter((row) => row.baseline && isFiniteNumber(row.baseline.score));
  if (!comparableRows.length) {
    return {
      status: 'no_baseline',
      packKey: pack.packKey,
      packLabel: pack.label,
      packType: pack.packType,
      source: baselineBundle.source,
      budgets: baselineDefaults,
      message: 'No comparable scored baseline entries were found for this pack.',
      promptCount: rows.length,
      scoredPromptCount: scoredRows.length,
      missingBaselinePrompts,
      violations: [],
      regressions: [],
    };
  }

  const currentScores = comparableRows.map((row) => row.current.score);
  const baselineScores = comparableRows.map((row) => row.baseline.score);
  const currentAverage = mean(currentScores);
  const baselineAverage = mean(baselineScores);
  const averageDelta = roundToTenth(currentAverage - baselineAverage);
  const currentWeakFailureCount = comparableRows.filter((row) => isWeakOrFailure(row.current.verdict)).length;
  const baselineWeakFailureCount = comparableRows.filter((row) => isWeakOrFailure(row.baseline.verdict)).length;
  const weakFailureDelta = currentWeakFailureCount - baselineWeakFailureCount;
  const regressions = comparableRows
    .map((row) => ({
      critiqueRef: row.current.critiqueRef || row.baseline.critiqueRef,
      prompt: row.current.prompt,
      currentScore: row.current.score,
      baselineScore: row.baseline.score,
      delta: roundToTenth(row.current.score - row.baseline.score),
      currentVerdict: row.current.verdict,
      baselineVerdict: row.baseline.verdict,
    }))
    .sort((left, right) => left.delta - right.delta);

  const violations = [];
  if (pack.packType === 'golden') {
    for (const row of regressions) {
      if (row.currentScore < baselineDefaults.goldenFloor) {
        violations.push({
          type: 'golden_floor',
          critiqueRef: row.critiqueRef,
          prompt: row.prompt,
          message: `${row.critiqueRef} fell below the 7.0 floor (${formatScore(row.currentScore)}).`,
        });
      }
      if (row.delta < -baselineDefaults.maxGoldenDrop) {
        violations.push({
          type: 'prompt_drop',
          critiqueRef: row.critiqueRef,
          prompt: row.prompt,
          message: `${row.critiqueRef} dropped ${formatSigned(row.delta)} vs baseline.`,
        });
      }
    }
  }
  if (averageDelta < -baselineDefaults.maxAverageDrop) {
    violations.push({
      type: 'average_drop',
      message: `Average score dropped ${formatSigned(averageDelta)} vs baseline.`,
    });
  }
  if (weakFailureDelta > baselineDefaults.maxWeakFailureIncrease) {
    violations.push({
      type: 'weak_failure_increase',
      message: `Weak/failure count increased by ${weakFailureDelta}.`,
    });
  }

  const status = determineComparisonStatus(pack.blocking, violations, missingBaselinePrompts);

  return {
    status,
    packKey: pack.packKey,
    packLabel: pack.label,
    packType: pack.packType,
    source: baselineBundle.source,
    budgets: baselineDefaults,
    message: buildStatusMessage(status, pack.blocking),
    promptCount: rows.length,
    scoredPromptCount: scoredRows.length,
    comparablePromptCount: comparableRows.length,
    currentAverage,
    baselineAverage,
    averageDelta,
    currentWeakFailureCount,
    baselineWeakFailureCount,
    weakFailureDelta,
    missingBaselinePrompts,
    violations,
    regressions,
  };
}

export async function annotateCurationTemplate(curationTemplatePath, baselineBundle) {
  if (!baselineBundle) return;

  const entries = JSON.parse(await fs.readFile(curationTemplatePath, 'utf8'));
  const baselineByPrompt = new Map(baselineBundle.entries.map((entry) => [entry.prompt, entry]));
  const updated = entries.map((entry) => {
    const baseline = baselineByPrompt.get(entry.prompt);
    if (!baseline) {
      return entry;
    }
    return {
      ...entry,
      baseline: {
        runId: baselineBundle.source.runId,
        docPath: baselineBundle.source.docPath,
        mode: baselineBundle.source.mode,
        critiqueRef: baseline.critiqueRef,
        score: baseline.score,
        verdict: baseline.verdict,
        usefulnessSummary: baseline.usefulnessSummary,
      },
    };
  });

  await fs.writeFile(curationTemplatePath, `${JSON.stringify(updated, null, 2)}\n`);
}

export function renderComparisonMarkdown(comparison) {
  const lines = [];
  lines.push(`# ${comparison.packLabel} Baseline Comparison`);
  lines.push('');
  lines.push(`- Pack key: \`${comparison.packKey}\``);
  lines.push(`- Status: \`${comparison.status}\``);
  lines.push(`- Pack type: \`${comparison.packType}\``);
  lines.push(`- Prompt count: ${comparison.promptCount}`);
  lines.push(`- Scored prompts: ${comparison.scoredPromptCount}`);
  if (comparison.comparablePromptCount != null) {
    lines.push(`- Comparable prompts: ${comparison.comparablePromptCount}`);
  }
  if (comparison.source) {
    lines.push(`- Baseline source: ${comparison.source.mode} run \`${comparison.source.runId}\``);
    lines.push(`- Baseline doc: ${comparison.source.docPath}`);
  }
  lines.push(`- Message: ${comparison.message}`);
  lines.push('');
  lines.push('## Budgets');
  lines.push('');
  lines.push(`- Golden floor: ${comparison.budgets.goldenFloor.toFixed(1)}`);
  lines.push(`- Max prompt drop: ${comparison.budgets.maxGoldenDrop.toFixed(1)}`);
  lines.push(`- Max average drop: ${comparison.budgets.maxAverageDrop.toFixed(1)}`);
  lines.push(`- Max weak/failure increase: ${comparison.budgets.maxWeakFailureIncrease}`);
  lines.push('');

  if (comparison.currentAverage != null) {
    lines.push('## Score Summary');
    lines.push('');
    lines.push('| Current Avg | Baseline Avg | Delta | Current Weak+Failure | Baseline Weak+Failure | Delta |');
    lines.push('|---:|---:|---:|---:|---:|---:|');
    lines.push(
      `| ${formatScore(comparison.currentAverage)} | ${formatScore(comparison.baselineAverage)} | ${formatSigned(comparison.averageDelta)} | ${comparison.currentWeakFailureCount} | ${comparison.baselineWeakFailureCount} | ${formatSigned(comparison.weakFailureDelta)} |`
    );
    lines.push('');
  }

  if (comparison.violations.length) {
    lines.push('## Violations');
    lines.push('');
    for (const violation of comparison.violations) {
      lines.push(`- ${violation.message}`);
    }
    lines.push('');
  }

  if (comparison.missingBaselinePrompts?.length) {
    lines.push('## Missing Baseline Coverage');
    lines.push('');
    for (const prompt of comparison.missingBaselinePrompts) {
      lines.push(`- ${prompt}`);
    }
    lines.push('');
  }

  if (comparison.regressions.length) {
    lines.push('## Prompt Deltas');
    lines.push('');
    lines.push('| Critique Ref | Prompt | Current | Baseline | Delta | Current Verdict | Baseline Verdict |');
    lines.push('|---|---|---:|---:|---:|---|---|');
    for (const row of comparison.regressions) {
      lines.push(
        `| \`${escapeTable(row.critiqueRef)}\` | ${escapeTable(row.prompt)} | ${formatScore(row.currentScore)} | ${formatScore(row.baselineScore)} | ${formatSigned(row.delta)} | ${escapeTable(row.currentVerdict)} | ${escapeTable(row.baselineVerdict)} |`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function loadBlessedBaselineBundle(area, prompts) {
  const config = JSON.parse(await fs.readFile(BLESSED_BASELINES_PATH, 'utf8'));
  const baselineRef = config.blessed?.[area];
  if (!baselineRef) {
    return null;
  }

  const run = await loadRunEntries({
    docPath: path.join(ROOT, baselineRef.docPath),
    runId: baselineRef.runId,
  });

  return {
    source: {
      mode: 'blessed',
      docPath: baselineRef.docPath,
      runId: baselineRef.runId,
    },
    entries: filterEntriesByPrompt(run.entries, prompts),
  };
}

async function findLatestBaselineBundle(prompts) {
  const candidates = [];
  for (const docPath of LEDGER_PATHS) {
    const runs = await loadAllRuns(docPath);
    for (const run of runs) {
      const filteredEntries = filterEntriesByPrompt(run.entries, prompts);
      if (filteredEntries.length === prompts.length && filteredEntries.every((entry) => isFiniteNumber(entry.score))) {
        candidates.push({
          source: {
            mode: 'latest',
            docPath: path.relative(ROOT, docPath),
            runId: run.metadata.runId,
          },
          generatedAt: run.metadata.generatedAt || run.metadata.runId,
          entries: filteredEntries,
        });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));
  const latest = candidates[0];
  return {
    source: latest.source,
    entries: latest.entries,
  };
}

async function loadBaselineDefaults() {
  const config = JSON.parse(await fs.readFile(BLESSED_BASELINES_PATH, 'utf8'));
  return config.defaults;
}

async function loadRunEntries({ docPath, runId }) {
  const runs = await loadAllRuns(docPath);
  const match = runs.find((run) => run.metadata.runId === runId);
  if (!match) {
    throw new Error(`Could not find run ${runId} in ${docPath}`);
  }
  return match;
}

async function loadAllRuns(docPath) {
  const text = await fs.readFile(docPath, 'utf8');
  const matches = [...text.matchAll(/<!-- CHAT_EVAL_LEDGER_RUN (\{.+?\}) -->/g)];
  const runs = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const metadata = JSON.parse(match[1]);
    const blockStart = match.index;
    const nextBlockStart = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const block = text.slice(blockStart, nextBlockStart);
    runs.push({
      metadata,
      entries: parseEntriesFromRunBlock(block),
    });
  }

  return runs;
}

function parseEntriesFromRunBlock(block) {
  return block
    .split('\n#### ')
    .slice(1)
    .map((entryBlock) => {
      const fullBlock = `#### ${entryBlock}`;
      const heading = fullBlock.match(/^####\s+(\S+)\s+(.+)$/m);
      const critiqueRef = heading?.[1]?.trim() || null;
      const prompt = heading?.[2]?.trim() || null;
      if (!prompt) {
        return null;
      }

      return {
        critiqueRef,
        prompt,
        score: parseScore(fullBlock, 'User score'),
        verdict: matchField(fullBlock, 'Verdict'),
        usefulnessSummary: matchField(fullBlock, 'Usefulness summary'),
      };
    })
    .filter(Boolean);
}

function filterEntriesByPrompt(entries, prompts) {
  const promptSet = new Set(prompts);
  return entries.filter((entry) => promptSet.has(entry.prompt));
}

function matchField(block, label) {
  const match = block.match(new RegExp(`- ${escapeRegExp(label)}: (.+)`));
  return match?.[1]?.trim() || null;
}

function parseScore(block, label) {
  const raw = matchField(block, label);
  if (!raw) return null;
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)\/10/);
  return match ? Number(match[1]) : null;
}

function determineComparisonStatus(isBlockingPack, violations, missingBaselinePrompts) {
  if (isBlockingPack && violations.length) {
    return 'block';
  }
  if (violations.length || missingBaselinePrompts.length) {
    return 'warn';
  }
  return 'pass';
}

function buildStatusMessage(status, isBlockingPack) {
  switch (status) {
    case 'block':
      return isBlockingPack ? 'This pack failed the current regression budgets.' : 'This pack would fail the budgets if blocking were enabled.';
    case 'warn':
      return 'This pack needs review before it should be promoted.';
    case 'pass':
      return 'This pack is inside the current regression budgets.';
    case 'awaiting_curation':
      return 'Manual scoring is still required before the baseline verdict is meaningful.';
    case 'no_baseline':
      return 'No matching baseline was available for comparison.';
    default:
      return 'Comparison completed.';
  }
}

function countScoredEntries(entries) {
  return entries.filter((entry) => isFiniteNumber(entry.score)).length;
}

function mean(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null;
}

function roundToTenth(value) {
  return Number(value.toFixed(1));
}

function isWeakOrFailure(verdict) {
  return verdict === 'Weak' || verdict === 'Failure';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatScore(value) {
  return isFiniteNumber(value) ? `${value.toFixed(1)}/10` : '-';
}

function formatSigned(value) {
  if (!isFiniteNumber(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
