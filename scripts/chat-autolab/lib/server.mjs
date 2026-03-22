import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureLocalServer({
  cwd,
  port,
  serverLogPath,
  env,
  existingPid = null,
}) {
  const origin = `http://127.0.0.1:${port}`;
  if (await isServerHealthy(origin)) {
    return {
      origin,
      pid: existingPid,
      evalSecret: env.CHAT_EVAL_SECRET,
      startedByAutolab: false,
    };
  }

  const evalSecret = env.CHAT_EVAL_SECRET || crypto.randomUUID();
  await fs.mkdir(path.dirname(serverLogPath), { recursive: true });
  const logHandle = await fs.open(serverLogPath, 'a');

  const child = spawn(
    'pnpm',
    ['--filter', '@publisheriq/admin', 'exec', 'next', 'dev', '--port', String(port)],
    {
      cwd,
      env: {
        ...process.env,
        ...env,
        CHAT_EVAL_SECRET: evalSecret,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout?.pipe(logHandle.createWriteStream());
  child.stderr?.pipe(logHandle.createWriteStream());
  child.once('exit', () => {
    void logHandle.close();
  });

  try {
    await waitForHealthy(origin);
  } catch (error) {
    await stopServerProcess(child);
    throw error;
  }

  return {
    origin,
    pid: child.pid,
    evalSecret,
    startedByAutolab: true,
    child,
  };
}

export async function stopServerProcess(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill('SIGTERM');
  const stopped = await waitForExit(child, 5000);
  if (stopped) {
    return;
  }

  child.kill('SIGKILL');
  await waitForExit(child, 1000);
}

async function isServerHealthy(origin) {
  try {
    const response = await fetch(new URL('/login', origin), {
      redirect: 'manual',
    });
    return response.status === 200 || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}

async function waitForHealthy(origin, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy(origin)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for local admin server at ${origin}`);
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onExit = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      child.off('exit', onExit);
      child.off('error', onExit);
    };

    child.once('exit', onExit);
    child.once('error', onExit);
  });
}
