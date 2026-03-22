#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CURRENT_LEDGER_PATH = path.join(ROOT, 'docs', 'chat-prompt-evals.md');

const CONFIG = [
  {
    targetOutDir: '/tmp/publisheriq-chat-evals/round-2-sections-1-2',
    source: {
      type: 'ledger',
      runId: '2026-03-21T00:03:14.910Z',
    },
  },
  {
    targetOutDir: '/tmp/publisheriq-chat-evals/round-2-sections-3-4',
    source: {
      type: 'ledger',
      runId: '2026-03-21T00:08:57.725Z',
    },
  },
  {
    targetOutDir: '/tmp/publisheriq-chat-evals/round-2-section-5',
    source: {
      type: 'json',
      filePath: '/tmp/publisheriq-chat-evals/critique-section-5-2026-03-21T07-27-26-172Z/curation-template.json',
    },
  },
];

async function main() {
  const ledgerText = await fs.readFile(CURRENT_LEDGER_PATH, 'utf8');

  for (const config of CONFIG) {
    const targetPath = path.join(config.targetOutDir, 'curation-template.json');
    const target = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    const sourceEntries = config.source.type === 'ledger'
      ? parseRunEntries(ledgerText, config.source.runId)
      : JSON.parse(await fs.readFile(config.source.filePath, 'utf8'));

    const sourceByPrompt = new Map(sourceEntries.map((entry) => [entry.prompt, entry]));
    const seeded = target.map((entry) => {
      const source = sourceByPrompt.get(entry.prompt);
      if (!source) {
        return entry;
      }
      return {
        ...entry,
        score: source.score ?? entry.score ?? null,
        verdict: source.verdict ?? entry.verdict ?? null,
        usefulnessVerdict: source.usefulnessVerdict ?? inferUsefulnessVerdict(source.verdict),
        usefulnessSummary: source.usefulnessSummary ?? entry.usefulnessSummary ?? null,
        curatorNotes: source.curatorNotes ?? entry.curatorNotes ?? null,
        scoreBreakdown: {
          directness: source.scoreBreakdown?.directness ?? entry.scoreBreakdown?.directness ?? null,
          completeness: source.scoreBreakdown?.completeness ?? entry.scoreBreakdown?.completeness ?? null,
          relevance: source.scoreBreakdown?.relevance ?? entry.scoreBreakdown?.relevance ?? null,
          trustworthiness: source.scoreBreakdown?.trustworthiness ?? entry.scoreBreakdown?.trustworthiness ?? null,
          decisionValue: source.scoreBreakdown?.decisionValue ?? entry.scoreBreakdown?.decisionValue ?? null,
          graceUnderAmbiguity:
            source.scoreBreakdown?.graceUnderAmbiguity ?? entry.scoreBreakdown?.graceUnderAmbiguity ?? null,
        },
      };
    });

    await fs.writeFile(targetPath, `${JSON.stringify(seeded, null, 2)}\n`);
    console.log(`Seeded curation: ${targetPath}`);
  }
}

function parseRunEntries(ledgerText, runId) {
  const startMarker = `## Run ${runId}`;
  const start = ledgerText.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Could not find run block for ${runId}`);
  }

  const nextRun = ledgerText.indexOf('<!-- CHAT_EVAL_LEDGER_RUN', start + startMarker.length);
  const block = ledgerText.slice(start, nextRun === -1 ? undefined : nextRun);
  const entryBlocks = block.split('\n#### ').slice(1);

  return entryBlocks.map((entryBlock) => {
    const fullBlock = `#### ${entryBlock}`;
    const heading = fullBlock.match(/^#### (.+)$/m)?.[1]?.trim();
    const prompt = heading.replace(/^#\d+\s+/, '').trim();
    const score = parseScore(fullBlock, 'User score');
    const verdict = matchField(fullBlock, 'Verdict');
    const usefulnessSummary = matchField(fullBlock, 'Usefulness summary');
    const curatorNotes = matchField(fullBlock, 'Rationale');
    const scoreBreakdown = parseBreakdown(matchField(fullBlock, 'Score breakdown'));

    return {
      prompt,
      score,
      verdict,
      usefulnessVerdict: inferUsefulnessVerdict(verdict),
      usefulnessSummary,
      curatorNotes,
      scoreBreakdown,
    };
  });
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

function parseBreakdown(raw) {
  if (!raw) {
    return {
      directness: null,
      completeness: null,
      relevance: null,
      trustworthiness: null,
      decisionValue: null,
      graceUnderAmbiguity: null,
    };
  }

  return {
    directness: extractBreakdownScore(raw, 'Directness'),
    completeness: extractBreakdownScore(raw, 'Completeness'),
    relevance: extractBreakdownScore(raw, 'Relevance'),
    trustworthiness: extractBreakdownScore(raw, 'Trustworthiness'),
    decisionValue: extractBreakdownScore(raw, 'Decision value'),
    graceUnderAmbiguity: extractBreakdownScore(raw, 'Grace'),
  };
}

function extractBreakdownScore(raw, label) {
  const match = raw.match(new RegExp(`${escapeRegExp(label)} ([0-9]+)\\/5`));
  return match ? Number(match[1]) : null;
}

function inferUsefulnessVerdict(verdict) {
  if (verdict === 'Strong' || verdict === 'Good') return 'Useful';
  if (verdict === 'Mixed') return 'Partially useful';
  if (verdict === 'Weak' || verdict === 'Failure') return 'Not useful';
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
