import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ROOT } from './constants.mjs';

const execFileAsync = promisify(execFile);
const PROTECTED_BRANCHES = new Set(['main', 'master']);

export async function ensureCampaignStart(cwd = ROOT) {
  await ensureNoGitOperationInProgress(cwd);
  const branch = await getCurrentBranch(cwd);
  if (!branch) {
    throw new Error('chat-autolab cannot start from a detached HEAD. Checkout a branch first.');
  }
  if (PROTECTED_BRANCHES.has(branch)) {
    throw new Error(`chat-autolab refuses to run on "${branch}". Checkout a non-main branch first.`);
  }

  const snapshot = await getWorkingTreeSnapshot(cwd);
  if (snapshot.hasChanges) {
    throw new Error('chat-autolab requires a clean working tree. Commit, stash, or discard your changes before starting.');
  }

  return {
    branch,
    headSha: await getHeadSha(cwd),
    workspaceDir: cwd,
  };
}

export async function ensureCampaignResume({ cwd = ROOT, branch, anchorSha }) {
  await ensureNoGitOperationInProgress(cwd);

  const currentBranch = await getCurrentBranch(cwd);
  if (!currentBranch) {
    throw new Error('chat-autolab cannot resume from a detached HEAD. Checkout the campaign branch first.');
  }
  if (currentBranch !== branch) {
    throw new Error(`chat-autolab run belongs to "${branch}", but the current branch is "${currentBranch}".`);
  }

  const snapshot = await getWorkingTreeSnapshot(cwd);
  if (snapshot.hasChanges) {
    throw new Error('chat-autolab resume requires a clean working tree.');
  }

  if (anchorSha) {
    const isDescendant = await isAncestor(anchorSha, await getHeadSha(cwd), cwd);
    if (!isDescendant) {
      throw new Error('Current HEAD is outside the campaign history. Refusing to resume automatically.');
    }
  }
}

export async function getCurrentBranch(cwd = ROOT) {
  const { stdout } = await execGit(['branch', '--show-current'], { cwd });
  return stdout.trim() || null;
}

export async function getHeadSha(cwd = ROOT) {
  const { stdout } = await execGit(['rev-parse', 'HEAD'], { cwd });
  return stdout.trim();
}

export async function getWorkingTreeSnapshot(cwd = ROOT) {
  const { stdout } = await execGit(['status', '--porcelain=v1', '-uall'], { cwd });
  const trackedFiles = new Set();
  const untrackedFiles = new Set();

  for (const line of stdout.split('\n')) {
    if (!line) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    if (!rawPath) continue;

    if (status === '??') {
      untrackedFiles.add(rawPath);
      continue;
    }

    for (const pathPart of rawPath.split(' -> ')) {
      trackedFiles.add(pathPart.trim());
    }
  }

  const tracked = [...trackedFiles];
  const untracked = [...untrackedFiles];
  return {
    trackedFiles: tracked,
    untrackedFiles: untracked,
    allFiles: [...new Set([...tracked, ...untracked])],
    hasChanges: tracked.length > 0 || untracked.length > 0,
  };
}

export async function discardWorkingTreeChanges(snapshot, cwd = ROOT) {
  if (!snapshot?.hasChanges) return;

  if (snapshot.trackedFiles?.length) {
    await execGit(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...snapshot.trackedFiles], { cwd });
  }

  if (snapshot.untrackedFiles?.length) {
    await execGit(['clean', '-fd', '--', ...snapshot.untrackedFiles], { cwd });
  }
}

export async function commitAll({ cwd = ROOT, message }) {
  await execGit(['add', '-A'], { cwd });
  await execGit(['commit', '-m', message], { cwd });
  return getHeadSha(cwd);
}

async function ensureNoGitOperationInProgress(cwd) {
  const markers = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'];
  for (const marker of markers) {
    const markerPath = await resolveGitPath(marker, cwd);
    if (await pathExists(markerPath)) {
      throw new Error(`chat-autolab cannot run while git state "${marker}" exists. Finish or abort the in-progress git operation first.`);
    }
  }
}

async function resolveGitPath(relativePath, cwd) {
  const { stdout } = await execGit(['rev-parse', '--git-path', relativePath], { cwd });
  return stdout.trim();
}

async function isAncestor(ancestorSha, descendantSha, cwd) {
  try {
    await execGit(['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd });
    return true;
  } catch {
    return false;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function execGit(args, { cwd = ROOT } = {}) {
  return execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024 * 8,
  });
}
