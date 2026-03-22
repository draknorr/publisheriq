import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

export const LEDGER_PATHS = [
  path.join(ROOT, 'docs', 'chat-prompt-evals.md'),
  path.join(ROOT, 'docs', 'chat-prompt-evals-round-2.md'),
];

export async function loadAllLedgerRuns() {
  const runs = [];
  for (const docPath of LEDGER_PATHS) {
    const text = await safeReadFile(docPath);
    if (!text) continue;

    const matches = [...text.matchAll(/<!-- CHAT_EVAL_LEDGER_RUN (\{.+?\}) -->/g)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const metadata = JSON.parse(match[1]);
      const blockStart = match.index;
      const nextBlockStart = index + 1 < matches.length ? matches[index + 1].index : text.length;
      const block = text.slice(blockStart, nextBlockStart);

      runs.push({
        docPath,
        metadata,
        entries: parseEntriesFromRunBlock(block),
      });
    }
  }

  return runs;
}

export async function findLatestRunForPrompts(prompts) {
  const promptSet = new Set(prompts);
  const runs = await loadAllLedgerRuns();
  const candidates = runs.filter((run) => {
    const entries = run.entries.filter((entry) => promptSet.has(entry.prompt));
    return entries.length === prompts.length && entries.every((entry) => typeof entry.score === 'number');
  });

  candidates.sort((left, right) => Date.parse(runTimestamp(right)) - Date.parse(runTimestamp(left)));
  return candidates[0] || null;
}

export async function findRunById(docPath, runId) {
  const runs = await loadAllLedgerRuns();
  return (
    runs.find((run) => path.resolve(run.docPath) === path.resolve(docPath) && run.metadata.runId === runId) || null
  );
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
        rationale: matchField(fullBlock, 'Rationale'),
      };
    })
    .filter(Boolean);
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

function runTimestamp(run) {
  return run.metadata.generatedAt || run.metadata.runId || '1970-01-01T00:00:00.000Z';
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
