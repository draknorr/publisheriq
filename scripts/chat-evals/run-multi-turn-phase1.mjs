#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_ORIGIN = process.env.CHAT_EVAL_ORIGIN || 'https://www.publisheriq.app';
const DEFAULT_OUT_DIR_BASE = path.join('/tmp', 'publisheriq-chat-evals');
const GENERIC_RUNNER_PATH = path.join(ROOT, 'scripts/chat-evals', 'run.mjs');
const SCENARIOS_PATH = path.join(ROOT, 'scripts/chat-evals', 'multi-turn-phase1-scenarios.json');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir ?? buildDefaultOutDir();

  await fs.mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'report.md');

  await runGenericRunner({
    outDir,
    reportPath,
    origin: args.origin ?? DEFAULT_ORIGIN,
  });

  const summary = await renderDraftArtifacts(outDir);
  console.log(`Draft run markdown: ${summary.draftRunPath}`);
  console.log(`Curation template: ${summary.curationTemplatePath}`);
  console.log(`Raw artifacts: ${outDir}`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
  }
  return args;
}

function buildDefaultOutDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(DEFAULT_OUT_DIR_BASE, `multi-turn-phase1-${timestamp}`);
}

async function runGenericRunner({ outDir, reportPath, origin }) {
  const env = {
    ...process.env,
    CHAT_EVAL_ORIGIN: origin,
    CHAT_EVAL_CONCURRENCY: '1',
    CHAT_EVAL_DELAY_MS: process.env.CHAT_EVAL_DELAY_MS || '1000',
    CHAT_EVAL_SCENARIOS_FILE: SCENARIOS_PATH,
    CHAT_EVAL_OUT_DIR: outDir,
    CHAT_EVAL_DOC_PATH: reportPath,
  };

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

async function renderDraftArtifacts(outDir) {
  const scenarios = JSON.parse(await fs.readFile(SCENARIOS_PATH, 'utf8'));
  const results = JSON.parse(await fs.readFile(path.join(outDir, 'results.json'), 'utf8'));
  const draftRunPath = path.join(outDir, 'ledger-run-draft.md');
  const curationTemplatePath = path.join(outDir, 'curation-template.json');

  const draftLines = ['# Multi-Turn Phase 1 Draft Run', '', `- Raw artifacts: ${outDir}`, ''];
  draftLines.push('## Scenario Inventory', '');
  draftLines.push('| Scenario | Turn Count | Notes |');
  draftLines.push('|---|---:|---|');
  for (const scenario of scenarios) {
    draftLines.push(`| ${escapeTable(scenario.name)} | ${scenario.turns.length} | ${escapeTable(scenario.notes || '')} |`);
  }
  draftLines.push('', '## Results', '');

  for (const result of results) {
    draftLines.push(`### ${result.scenario_name}`);
    draftLines.push('');
    draftLines.push(`- Status: ${result.status}`);
    draftLines.push(`- Turns: ${result.turns.length}`);
    draftLines.push('- User score: `TBD`');
    draftLines.push('- Verdict: `TBD`');
    draftLines.push('- Usefulness summary: `TBD`');
    draftLines.push('- Curator notes: `TBD`');
    draftLines.push('');

    for (const turn of result.turns) {
      draftLines.push(`#### Turn ${turn.turn_index}`);
      draftLines.push(`- User: ${turn.user_prompt}`);
      if (turn.expectation) {
        draftLines.push(`- Expectation: ${turn.expectation}`);
      }
      draftLines.push(`- Status: ${turn.status}`);
      draftLines.push(`- Tools: ${turn.tool_calls.map((tool) => tool.name).join(', ') || '-'}`);
      draftLines.push(`- Timing: ${turn.timing?.totalMs ?? '-'}ms`);
      if (turn.session_context_summary) {
        draftLines.push(`- Session context: ${escapeTable(JSON.stringify(turn.session_context_summary))}`);
      }
      draftLines.push('');
      draftLines.push('```md');
      draftLines.push(turn.assistant_output_raw || turn.error_message || '[no assistant output captured]');
      draftLines.push('```');
      draftLines.push('');
    }
  }

  const curationTemplate = results.map((result) => ({
    scenarioId: result.scenario_id,
    scenarioName: result.scenario_name,
    verdict: null,
    score: null,
    usefulnessSummary: null,
    curatorNotes: null,
    turnScores: result.turns.map((turn) => ({
      turnIndex: turn.turn_index,
      userPrompt: turn.user_prompt,
      expectation: turn.expectation,
      score: null,
      notes: null,
    })),
  }));

  await fs.writeFile(draftRunPath, `${draftLines.join('\n')}\n`);
  await fs.writeFile(curationTemplatePath, `${JSON.stringify(curationTemplate, null, 2)}\n`);

  return {
    draftRunPath,
    curationTemplatePath,
  };
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|');
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
