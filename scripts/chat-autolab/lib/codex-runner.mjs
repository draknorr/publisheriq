import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

export async function runCodexIteration({
  cwd,
  prompt,
  lastMessagePath,
  onEvent = null,
}) {
  return runCodexPrompt({
    cwd,
    prompt,
    lastMessagePath,
    sandbox: 'workspace-write',
    fullAuto: true,
    onEvent,
  });
}

export async function runCodexPrompt({
  cwd,
  prompt,
  lastMessagePath,
  sandbox = 'read-only',
  fullAuto = false,
  model = null,
  onEvent = null,
  timeoutMs = null,
  onHeartbeat = null,
  heartbeatMs = 15000,
}) {
  await fs.writeFile(lastMessagePath, '');

  return new Promise((resolve, reject) => {
    const args = ['exec', '--json', '--sandbox', sandbox, '-C', cwd, '-o', lastMessagePath];
    if (fullAuto) {
      args.push('--full-auto');
    }
    if (model) {
      args.push('-m', model);
    }
    args.push('-');

    const child = spawn('codex', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      detached: process.platform !== 'win32',
    });
    let settled = false;
    const startedAt = Date.now();
    const timeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            const error = new Error(`codex exec timed out after ${timeoutMs}ms`);
            error.code = 'CODEX_TIMEOUT';
            terminateCodexProcess(child, 'SIGTERM');
            setTimeout(() => {
              if (child.exitCode === null) {
                terminateCodexProcess(child, 'SIGKILL');
              }
            }, 1000).unref();
            safeReject(error);
          }, timeoutMs)
        : null;
    const heartbeat =
      typeof onHeartbeat === 'function' && Number.isFinite(heartbeatMs) && heartbeatMs > 0
        ? setInterval(() => {
            try {
              onHeartbeat({
                elapsedMs: Date.now() - startedAt,
                pid: child.pid,
              });
            } catch {
              // Ignore heartbeat callback errors.
            }
          }, heartbeatMs)
        : null;

    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let stderr = '';
    let stdoutBuffer = '';

    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === 'turn.completed' && event.usage) {
            usage = {
              inputTokens: Number(event.usage.input_tokens || 0),
              outputTokens: Number(event.usage.output_tokens || 0),
              totalTokens:
                Number(event.usage.input_tokens || 0) + Number(event.usage.output_tokens || 0),
            };
          }
          if (event.type === 'item.completed' && typeof event.item?.text === 'string' && onEvent) {
            onEvent(event.item.text);
          }
        } catch {
          // Ignore non-JSON lines emitted by the CLI.
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      safeReject(error);
    });
    child.on('exit', async (code) => {
      cleanupTimers();
      if (settled) {
        return;
      }
      if (code !== 0) {
        const error = new Error(`codex exec failed with code ${code}: ${stderr.trim()}`);
        error.code = 'CODEX_EXEC_FAILED';
        safeReject(error);
        return;
      }
      try {
        const lastMessage = await safeRead(lastMessagePath);
        const text = lastMessage.trim();
        safeResolve({
          usage,
          text,
          content: text,
          lastMessage: text,
        });
      } catch (error) {
        safeReject(error);
      }
    });

    function cleanupTimers() {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }

    function safeResolve(value) {
      if (settled) return;
      settled = true;
      cleanupTimers();
      resolve(value);
    }

    function safeReject(error) {
      if (settled) return;
      settled = true;
      cleanupTimers();
      reject(error);
    }
  });
}

async function safeRead(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function terminateCodexProcess(child, signal) {
  if (!child?.pid) {
    return;
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to direct child kill.
    }
  }

  try {
    child.kill(signal);
  } catch {
    // Best-effort cleanup for subprocess termination.
  }
}
