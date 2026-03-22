#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'docs', 'chat-prompt-evals-round-2.md');

const BATCHES = [
  {
    batchKey: 'sections-1-2',
    batchLabel: 'Sections 1-2',
    outDir: '/tmp/publisheriq-chat-evals/round-2-sections-1-2',
    scopeLabel: 'Round 2 sections 1-2 full live run',
    scopeKey: 'round_2_sections_1_2_full_live_run',
  },
  {
    batchKey: 'sections-3-4',
    batchLabel: 'Sections 3-4',
    outDir: '/tmp/publisheriq-chat-evals/round-2-sections-3-4',
    scopeLabel: 'Round 2 sections 3-4 full live run',
    scopeKey: 'round_2_sections_3_4_full_live_run',
  },
  {
    batchKey: 'section-5',
    batchLabel: 'Section 5',
    outDir: '/tmp/publisheriq-chat-evals/round-2-section-5',
    scopeLabel: 'Round 2 section 5 full live run',
    scopeKey: 'round_2_section_5_full_live_run',
  },
  {
    batchKey: 'section-6',
    batchLabel: 'Section 6',
    outDir: '/tmp/publisheriq-chat-evals/round-2-section-6',
    scopeLabel: 'Round 2 section 6 full live run',
    scopeKey: 'round_2_section_6_full_live_run',
  },
];

async function main() {
  const batchRuns = [];
  for (const batch of BATCHES) {
    batchRuns.push(await loadBatch(batch));
  }

  for (const batch of batchRuns) {
    const scoredRunPath = path.join(batch.outDir, 'scored-run.md');
    await fs.writeFile(scoredRunPath, `${renderBatchMarkdown(batch)}\n`);
  }

  const roundMarkdown = renderRoundMarkdown(batchRuns);
  await fs.writeFile(OUTPUT_PATH, `${roundMarkdown}\n`);

  console.log(`Wrote round ledger: ${OUTPUT_PATH}`);
  for (const batch of batchRuns) {
    console.log(`Wrote batch run: ${path.join(batch.outDir, 'scored-run.md')}`);
  }
}

async function loadBatch(batch) {
  const results = JSON.parse(await fs.readFile(path.join(batch.outDir, 'results.json'), 'utf8'));
  const curation = JSON.parse(await fs.readFile(path.join(batch.outDir, 'curation-template.json'), 'utf8'));
  const reportMarkdown = await fs.readFile(path.join(batch.outDir, 'report.md'), 'utf8');

  const resultsByPrompt = new Map(results.map((row) => [row.prompt_text, row]));
  const curatedResults = curation.map((entry) => {
    const result = resultsByPrompt.get(entry.prompt);
    if (!result) {
      throw new Error(`Missing result row for prompt: ${entry.prompt}`);
    }
    return {
      ...entry,
      result,
      critiqueRef: entry.critiqueRef || formatCritiqueRef(entry),
    };
  });

  const timingValues = curatedResults
    .map((row) => row.result.timing?.totalMs)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  const averageUserScore = mean(curatedResults.map((row) => row.score).filter((value) => Number.isFinite(value)));
  const weakOrFailureCount = curatedResults.filter(
    (row) => typeof row.verdict === 'string' && ['Weak', 'Failure'].includes(row.verdict)
  ).length;

  const verdictCounts = new Map();
  for (const row of curatedResults) {
    if (typeof row.verdict !== 'string') continue;
    verdictCounts.set(row.verdict, (verdictCounts.get(row.verdict) || 0) + 1);
  }

  const metadata = {
    generatedAt: matchMetadata(reportMarkdown, 'Generated'),
    environment: matchMetadata(reportMarkdown, 'Environment'),
    authAccount: matchMetadata(reportMarkdown, 'Auth account'),
    executionMode: matchMetadata(reportMarkdown, 'Execution mode'),
    concurrency: matchMetadata(reportMarkdown, 'Concurrency'),
    delayBetweenRequests: matchMetadata(reportMarkdown, 'Delay between request starts'),
  };

  return {
    ...batch,
    metadata,
    curatedResults,
    promptCount: curatedResults.length,
    promptRefs: curatedResults.map((row) => row.critiqueRef),
    timingSummary: {
      averageMs: mean(timingValues),
      medianMs: percentile(timingValues, 0.5),
      p95Ms: percentile(timingValues, 0.95),
      fastestMs: timingValues[0] ?? null,
      slowestMs: timingValues.at(-1) ?? null,
    },
    averageUserScore,
    weakOrFailureCount,
    verdictMix: renderVerdictMix(verdictCounts),
  };
}

function renderRoundMarkdown(batches) {
  const allRows = batches.flatMap((batch) =>
    batch.curatedResults.map((row) => ({
      batchLabel: batch.batchLabel,
      critiqueRef: row.critiqueRef,
      prompt: row.prompt,
      family: row.family,
      primaryPersona: row.primaryPersona,
      score: row.score,
      verdict: row.verdict,
      usefulnessSummary: row.usefulnessSummary,
    }))
  );

  allRows.sort(compareRowsByScore);

  const lines = [];
  lines.push('# /chat Prompt Evaluations Round 2');
  lines.push('');
  lines.push('Second large live-eval ledger for the critique-suite prompts drawn from `docs/chat-output-user-critique.md`.');
  lines.push('');
  lines.push('Historical round-1 and targeted reruns remain in [docs/chat-prompt-evals.md](/Users/ryanbohmann/Desktop/publisheriq/docs/chat-prompt-evals.md).');
  lines.push('');
  lines.push('## Suite');
  lines.push('');
  lines.push('- Scope: full second-round live runs across sections `1` through `6` from `docs/chat-output-user-critique.md`');
  lines.push('- Prompt count per batch: `23` for sections `1`/`2`, `13` for sections `3`/`4`, `16` for section `5`, `20` for section `6`');
  lines.push(`- Total logged entries: \`${allRows.length}\``);
  lines.push('- Runbook: `docs/chat-prompt-evals-runbook.md` documents the checked-in section `1`/`2`, `3`/`4`, `5`, and `6` wrappers');
  lines.push('- Primary scoring mode: curated user-centric review from one primary persona per prompt');
  lines.push('- Rubric: `Directness 15%`, `Completeness 15%`, `Relevance 15%`, `Trustworthiness 20%`, `Decision value/usefulness 25%`, `Grace under ambiguity 10%`');
  lines.push('- Verdict bands: `Strong 8.5-10`, `Good 7.0-8.4`, `Mixed 5.5-6.9`, `Weak 4.0-5.4`, `Failure <4.0`');
  lines.push('- Sections `5` and `6` use stable `suiteKey` refs where the original critique numbering is not fully recoverable from checked-in sources');
  lines.push('');
  lines.push('## Batch Index');
  lines.push('');
  lines.push('| Run | Date | Scope | Prompts | Avg Time | Median | P95 | Avg User Score | Weak+Failure | Artifacts |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const batch of batches) {
    lines.push(
      `| \`${escapeTable(batch.metadata.generatedAt)}\` | ${escapeTable(batch.metadata.generatedAt)} | \`${escapeTable(batch.scopeLabel)}\` | ${batch.promptCount} | ${formatMs(batch.timingSummary.averageMs)} | ${formatMs(batch.timingSummary.medianMs)} | ${formatMs(batch.timingSummary.p95Ms)} | ${formatScore(batch.averageUserScore)} | ${batch.weakOrFailureCount} | \`${escapeTable(batch.outDir)}\` |`
    );
  }
  lines.push('');
  lines.push('## Round Ranking');
  lines.push('');
  lines.push('| Rank | Batch | Critique Ref | Prompt | Family | Primary Persona | User Score | Verdict | Usefulness Summary |');
  lines.push('|---:|---|---|---|---|---|---:|---|---|');
  allRows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${escapeTable(row.batchLabel)} | \`${escapeTable(row.critiqueRef)}\` | ${escapeTable(row.prompt)} | ${escapeTable(row.family)} | ${escapeTable(row.primaryPersona)} | ${formatScore(row.score)} | ${escapeTable(row.verdict)} | ${escapeTable(row.usefulnessSummary)} |`
    );
  });
  lines.push('');

  for (const batch of batches) {
    lines.push(renderBatchMarkdown(batch));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function renderBatchMarkdown(batch) {
  const rankedRows = [...batch.curatedResults].sort(compareRowsByScore);

  const lines = [];
  lines.push(
    `<!-- CHAT_EVAL_LEDGER_RUN ${JSON.stringify({
      runId: batch.metadata.generatedAt,
      generatedAt: batch.metadata.generatedAt,
      environment: batch.metadata.environment,
      authAccount: batch.metadata.authAccount,
      promptCount: batch.promptCount,
      averageTotalMs: batch.timingSummary.averageMs,
      medianTotalMs: batch.timingSummary.medianMs,
      p95TotalMs: batch.timingSummary.p95Ms,
      averageUserScore: batch.averageUserScore,
      weakOrFailureCount: batch.weakOrFailureCount,
      artifactPath: batch.outDir,
      scope: batch.scopeKey,
      promptRefs: batch.promptRefs,
    })} -->`
  );
  lines.push(`## Run ${batch.metadata.generatedAt}`);
  lines.push('');
  lines.push(`- Generated: ${batch.metadata.generatedAt || 'unknown'}`);
  lines.push(`- Scope: ${batch.scopeLabel}`);
  lines.push(`- Prompt refs: ${batch.promptRefs.map((ref) => `\`${ref}\``).join(', ')}`);
  lines.push(`- Environment: ${batch.metadata.environment || 'unknown'}`);
  lines.push(`- Auth account: ${batch.metadata.authAccount || 'unknown'}`);
  lines.push(`- Raw artifacts: ${batch.outDir}`);
  lines.push(`- Curated curation JSON: ${path.join(batch.outDir, 'curation-template.json')}`);
  lines.push(`- Generic runner report: ${path.join(batch.outDir, 'report.md')}`);
  lines.push(`- Raw JSON results: ${path.join(batch.outDir, 'results.json')}`);
  lines.push(`- Prompt count: ${batch.promptCount}`);
  lines.push(`- Average user score: ${formatScore(batch.averageUserScore)}`);
  lines.push(`- Verdict mix: ${batch.verdictMix}`);
  lines.push('');
  lines.push('### Latency Summary');
  lines.push('');
  lines.push('| Average | Median | P95 | Fastest | Slowest |');
  lines.push('|---:|---:|---:|---:|---:|');
  lines.push(
    `| ${formatMs(batch.timingSummary.averageMs)} | ${formatMs(batch.timingSummary.medianMs)} | ${formatMs(batch.timingSummary.p95Ms)} | ${formatMs(batch.timingSummary.fastestMs)} | ${formatMs(batch.timingSummary.slowestMs)} |`
  );
  lines.push('');
  lines.push('### Ranking');
  lines.push('');
  lines.push('| Rank | Critique Ref | Prompt | Family | Primary Persona | User Score | Verdict | Total Time | Usefulness Summary |');
  lines.push('|---:|---|---|---|---|---:|---|---:|---|');
  rankedRows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | \`${escapeTable(row.critiqueRef)}\` | ${escapeTable(row.prompt)} | ${escapeTable(row.family)} | ${escapeTable(row.primaryPersona)} | ${formatScore(row.score)} | ${escapeTable(row.verdict)} | ${row.result.timing?.totalMs ?? '-'} | ${escapeTable(row.usefulnessSummary)} |`
    );
  });
  lines.push('');
  lines.push('### Detailed Results');
  lines.push('');

  for (const row of rankedRows) {
    lines.push(`#### ${row.critiqueRef} ${row.prompt}`);
    lines.push('');
    if (row.suiteKey) {
      lines.push(`- Suite key: ${row.suiteKey}`);
    }
    if (row.critiqueId != null) {
      lines.push(`- Critique ID: ${row.critiqueId}`);
    }
    lines.push(`- Section: ${row.section}`);
    lines.push(`- Family: ${row.family}`);
    lines.push(`- Primary persona: ${row.primaryPersona}`);
    lines.push(`- User score: ${formatScore(row.score)}`);
    lines.push(`- Verdict: ${row.verdict}`);
    if (row.usefulnessVerdict) {
      lines.push(`- Usefulness verdict: ${row.usefulnessVerdict}`);
    }
    lines.push(`- Usefulness summary: ${row.usefulnessSummary || 'TBD'}`);
    lines.push(`- Rationale: ${row.curatorNotes || 'TBD'}`);
    lines.push(`- Score breakdown: ${formatBreakdown(row.scoreBreakdown)}`);
    lines.push(
      `- Timing: total ${row.result.timing?.totalMs ?? '-'}ms | llm ${row.result.timing?.llmMs ?? '-'}ms | tools ${row.result.timing?.toolsMs ?? '-'}ms | iterations ${row.result.iterations ?? '-'}`
    );
    lines.push(`- Tools: ${row.result.tool_calls.map((tool) => tool.name).join(', ') || '-'}`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Exact Output</summary>');
    lines.push('');
    lines.push('```md');
    lines.push(row.result.assistant_output_raw || '[no assistant output captured]');
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Tool Calls</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(row.result.tool_calls, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function formatCritiqueRef(row) {
  return Number.isFinite(row.critiqueId) ? `#${row.critiqueId}` : row.suiteKey || row.prompt;
}

function compareRowsByScore(left, right) {
  const scoreDelta = (left.score ?? Infinity) - (right.score ?? Infinity);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  const timeDelta = (left.result?.timing?.totalMs ?? Infinity) - (right.result?.timing?.totalMs ?? Infinity);
  if (timeDelta !== 0) {
    return timeDelta;
  }
  return String(left.prompt).localeCompare(String(right.prompt));
}

function mean(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const index = Math.ceil(values.length * ratio) - 1;
  return values[Math.max(0, Math.min(values.length - 1, index))];
}

function renderVerdictMix(verdictCounts) {
  const order = ['Strong', 'Good', 'Mixed', 'Weak', 'Failure'];
  const parts = [];
  for (const verdict of order) {
    const count = verdictCounts.get(verdict);
    if (count) {
      parts.push(`${verdict} ${count}`);
    }
  }
  return parts.join(' | ') || 'None';
}

function matchMetadata(reportMarkdown, label) {
  const match = reportMarkdown.match(new RegExp(`- ${escapeRegExp(label)}: (.+)`));
  return match?.[1]?.trim() || null;
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value}ms` : '-';
}

function formatScore(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}/10` : 'TBD';
}

function formatBreakdown(scoreBreakdown = {}) {
  return [
    `Directness ${scoreBreakdown.directness ?? 'TBD'}/5`,
    `Completeness ${scoreBreakdown.completeness ?? 'TBD'}/5`,
    `Relevance ${scoreBreakdown.relevance ?? 'TBD'}/5`,
    `Trustworthiness ${scoreBreakdown.trustworthiness ?? 'TBD'}/5`,
    `Decision value ${scoreBreakdown.decisionValue ?? 'TBD'}/5`,
    `Grace ${scoreBreakdown.graceUnderAmbiguity ?? 'TBD'}/5`,
  ].join(' | ');
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
