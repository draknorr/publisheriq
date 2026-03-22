import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadPackDefinition } from './prompt-packs.mjs';

const ROOT = process.cwd();
const DEFAULT_ORIGIN = process.env.CHAT_EVAL_ORIGIN || 'https://www.publisheriq.app';
const DEFAULT_OUT_DIR_BASE = path.join('/tmp', 'publisheriq-chat-evals');
const GENERIC_RUNNER_PATH = path.join(ROOT, 'scripts', 'chat-evals', 'run.mjs');

export function parseCommonArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--from-results') {
      args.fromResults = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      args.outDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--origin') {
      args.origin = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--max-prompts') {
      args.maxPrompts = Number(argv[index + 1]);
      index += 1;
      continue;
    }
  }
  return args;
}

export function buildDefaultOutDir(prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(DEFAULT_OUT_DIR_BASE, `${prefix}-${timestamp}`);
}

export async function runPackSuite({
  packKey,
  fromResults,
  outDir,
  origin = DEFAULT_ORIGIN,
  maxPrompts = 0,
}) {
  const pack = await loadPackDefinition(packKey);
  const selectedEntries =
    maxPrompts > 0 ? pack.entries.slice(0, Math.min(pack.entries.length, maxPrompts)) : pack.entries;

  const sourceDir = fromResults ?? outDir ?? buildDefaultOutDir(pack.defaultOutDirPrefix);
  const writeDir = outDir ?? fromResults ?? sourceDir;
  const reportSourcePath = path.join(sourceDir, 'report.md');
  const resultsSourcePath = path.join(sourceDir, 'results.json');

  if (!fromResults) {
    await fs.mkdir(writeDir, { recursive: true });
    const includeFilePath = path.join(writeDir, 'include-prompts.txt');
    const reportPath = path.join(writeDir, 'report.md');
    await fs.writeFile(includeFilePath, buildIncludeFileContents(selectedEntries));

    await runGenericRunner({
      outDir: writeDir,
      includeFilePath,
      reportPath,
      origin,
      maxPrompts,
    });
  } else if (writeDir !== sourceDir) {
    await fs.mkdir(writeDir, { recursive: true });
  }

  const summary = await renderDraftArtifacts({
    pack,
    selectedEntries,
    sourceDir,
    writeDir,
    reportSourcePath,
    resultsSourcePath,
  });

  return {
    pack,
    selectedEntries,
    sourceDir,
    writeDir,
    ...summary,
  };
}

function buildIncludeFileContents(entries) {
  return `${entries.map((row) => `${row.critiqueId ?? row.suiteKey} | ${row.prompt}`).join('\n')}\n`;
}

async function runGenericRunner({ outDir, includeFilePath, reportPath, origin, maxPrompts }) {
  const env = {
    ...process.env,
    CHAT_EVAL_ORIGIN: origin,
    CHAT_EVAL_CONCURRENCY: process.env.CHAT_EVAL_CONCURRENCY || '1',
    CHAT_EVAL_DELAY_MS: process.env.CHAT_EVAL_DELAY_MS || '3000',
    CHAT_EVAL_INCLUDE_PROMPTS_FILE: includeFilePath,
    CHAT_EVAL_OUT_DIR: outDir,
    CHAT_EVAL_DOC_PATH: reportPath,
  };
  if (maxPrompts > 0) {
    env.CHAT_EVAL_MAX_PROMPTS = String(maxPrompts);
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [GENERIC_RUNNER_PATH], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Generic chat eval runner exited with code ${code}`));
    });
  });
}

async function renderDraftArtifacts({ pack, selectedEntries, sourceDir, writeDir, reportSourcePath, resultsSourcePath }) {
  const results = JSON.parse(await fs.readFile(resultsSourcePath, 'utf8'));
  const reportMarkdown = await fs.readFile(reportSourcePath, 'utf8');
  const metadata = extractMetadata(reportMarkdown);
  const suiteResults = orderSuiteResults(results, selectedEntries);
  const timingSummary = summarizeTimings(suiteResults);
  const curationTemplate = buildCurationTemplate(pack, suiteResults);
  const draftRunPath = path.join(writeDir, 'ledger-run-draft.md');
  const curationTemplatePath = path.join(writeDir, 'curation-template.json');
  const runSummaryPath = path.join(writeDir, 'run-summary.json');
  const draftRunMarkdown = renderDraftRunMarkdown({
    pack,
    sourceDir,
    metadata,
    suiteResults,
    timingSummary,
  });

  await fs.writeFile(draftRunPath, draftRunMarkdown);
  await fs.writeFile(curationTemplatePath, `${JSON.stringify(curationTemplate, null, 2)}\n`);
  await fs.writeFile(
    runSummaryPath,
    `${JSON.stringify(
      {
        packKey: pack.packKey,
        packType: pack.packType,
        area: pack.area,
        sourceDir,
        writeDir,
        ...metadata,
        promptCount: suiteResults.length,
        timingSummary,
        results: suiteResults.map((row) => ({
          critiqueRef: row.suite.critiqueRef,
          critiqueId: row.suite.critiqueId,
          suiteKey: row.suite.suiteKey,
          prompt: row.prompt_text,
          section: row.suite.section,
          family: row.suite.family,
          primaryPersona: row.suite.primaryPersona,
          packTags: row.suite.packTags,
          totalMs: row.timing?.totalMs ?? null,
          tools: row.tool_calls.map((tool) => tool.name),
          status: row.status,
        })),
      },
      null,
      2
    )}\n`
  );

  return {
    draftRunPath,
    curationTemplatePath,
    runSummaryPath,
    metadata,
    timingSummary,
    suiteResults,
  };
}

function extractMetadata(reportMarkdown) {
  return {
    generatedAt: matchMetadata(reportMarkdown, 'Generated'),
    environment: matchMetadata(reportMarkdown, 'Environment'),
    authAccount: matchMetadata(reportMarkdown, 'Auth account'),
    executionMode: matchMetadata(reportMarkdown, 'Execution mode'),
    concurrency: matchMetadata(reportMarkdown, 'Concurrency'),
    delayBetweenRequests: matchMetadata(reportMarkdown, 'Delay between request starts'),
  };
}

function matchMetadata(reportMarkdown, label) {
  const match = reportMarkdown.match(new RegExp(`- ${escapeRegExp(label)}: (.+)`));
  return match?.[1]?.trim() || null;
}

function orderSuiteResults(results, selectedEntries) {
  const resultsByPrompt = new Map(results.map((row) => [row.prompt_text, row]));
  return selectedEntries.map((suiteRow) => {
    const result = resultsByPrompt.get(suiteRow.prompt);
    if (!result) {
      throw new Error(`Missing result row for prompt: ${suiteRow.prompt}`);
    }
    return {
      ...result,
      suite: suiteRow,
    };
  });
}

function summarizeTimings(results) {
  const values = results
    .map((row) => row.timing?.totalMs)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return {
    averageMs: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    medianMs: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    fastestMs: values[0] ?? null,
    slowestMs: values.at(-1) ?? null,
  };
}

function buildCurationTemplate(pack, results) {
  return results.map((row) => ({
    packKey: pack.packKey,
    packType: pack.packType,
    area: pack.area,
    critiqueRef: row.suite.critiqueRef,
    critiqueId: row.suite.critiqueId,
    suiteKey: row.suite.suiteKey,
    prompt: row.prompt_text,
    section: row.suite.section,
    family: row.suite.family,
    primaryPersona: row.suite.primaryPersona,
    packTags: row.suite.packTags,
    score: null,
    verdict: null,
    usefulnessVerdict: null,
    usefulnessSummary: null,
    curatorNotes: null,
    scoreBreakdown: {
      directness: null,
      completeness: null,
      relevance: null,
      trustworthiness: null,
      decisionValue: null,
      graceUnderAmbiguity: null,
    },
  }));
}

function renderDraftRunMarkdown({ pack, sourceDir, metadata, suiteResults, timingSummary }) {
  const lines = [];
  lines.push(`# ${pack.draftTitle}`);
  lines.push('');
  lines.push(`- Pack: \`${pack.packKey}\``);
  lines.push(`- Label: ${pack.label}`);
  lines.push(`- Type: \`${pack.packType}\``);
  lines.push(`- Area: \`${pack.area}\``);
  lines.push(`- Scope: ${pack.scopeDescription}`);
  lines.push(`- Generated: ${metadata.generatedAt || 'unknown'}`);
  lines.push(`- Environment: ${metadata.environment || 'unknown'}`);
  lines.push(`- Auth account: ${metadata.authAccount || 'unknown'}`);
  lines.push(`- Execution mode: ${metadata.executionMode || 'unknown'}`);
  lines.push(`- Concurrency: ${metadata.concurrency || 'unknown'}`);
  lines.push(`- Delay between request starts: ${metadata.delayBetweenRequests || 'unknown'}`);
  lines.push(`- Raw artifacts: ${sourceDir}`);
  lines.push(`- Prompt count: ${suiteResults.length}`);
  lines.push('');
  lines.push('## Latency Summary');
  lines.push('');
  lines.push('| Average | Median | P95 | Fastest | Slowest |');
  lines.push('|---:|---:|---:|---:|---:|');
  lines.push(
    `| ${formatMs(timingSummary.averageMs)} | ${formatMs(timingSummary.medianMs)} | ${formatMs(timingSummary.p95Ms)} | ${formatMs(timingSummary.fastestMs)} | ${formatMs(timingSummary.slowestMs)} |`
  );
  lines.push('');
  lines.push('## Prompt Inventory');
  lines.push('');
  lines.push('| Critique Ref | Section | Family | Primary Persona | Prompt | Tags |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of suiteResults.map((item) => item.suite)) {
    lines.push(
      `| \`${escapeTable(row.critiqueRef)}\` | ${escapeTable(row.section)} | ${escapeTable(row.family)} | ${escapeTable(row.primaryPersona)} | ${escapeTable(row.prompt)} | ${escapeTable(row.packTags.join(', '))} |`
    );
  }
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('| Critique Ref | Prompt | Total Time | Tools | Status |');
  lines.push('|---|---|---:|---|---|');
  for (const row of suiteResults) {
    lines.push(
      `| \`${escapeTable(row.suite.critiqueRef)}\` | ${escapeTable(row.prompt_text)} | ${row.timing?.totalMs ?? '-'} | ${escapeTable(row.tool_calls.map((tool) => tool.name).join(', ') || '-')} | ${row.status} |`
    );
  }
  lines.push('');
  lines.push('## Detailed Results');
  lines.push('');

  for (const row of suiteResults) {
    lines.push(`### ${row.suite.critiqueRef} ${row.prompt_text}`);
    lines.push('');
    if (row.suite.suiteKey) {
      lines.push(`- Suite key: ${row.suite.suiteKey}`);
    }
    if (row.suite.critiqueId != null) {
      lines.push(`- Critique ID: ${row.suite.critiqueId}`);
    }
    lines.push(`- Section: ${row.suite.section}`);
    lines.push(`- Family: ${row.suite.family}`);
    lines.push(`- Primary persona: ${row.suite.primaryPersona}`);
    lines.push(`- Pack tags: ${row.suite.packTags.join(', ') || '-'}`);
    lines.push('- User score: `TBD`');
    lines.push('- Verdict: `TBD`');
    lines.push('- Usefulness verdict: `TBD`');
    lines.push('- Usefulness summary: `TBD`');
    lines.push('- Curator notes: `TBD`');
    lines.push(
      `- Timing: total ${row.timing?.totalMs ?? '-'}ms | llm ${row.timing?.llmMs ?? '-'}ms | tools ${row.timing?.toolsMs ?? '-'}ms | iterations ${row.iterations ?? '-'}`
    );
    lines.push(`- Tools: ${row.tool_calls.map((tool) => tool.name).join(', ') || '-'}`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Exact Output</summary>');
    lines.push('');
    lines.push('```md');
    lines.push(row.assistant_output_raw || '[no assistant output captured]');
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Tool Calls</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(row.tool_calls, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const index = Math.ceil(values.length * ratio) - 1;
  return values[Math.max(0, Math.min(values.length - 1, index))];
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value}ms` : '-';
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
