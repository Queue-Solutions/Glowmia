import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUNTIME_DIR = resolve(process.cwd(), '.agent-runtime');
const RUNTIME_VENV_DIR = resolve(RUNTIME_DIR, 'backend-venv');
const RUNTIME_PYTHON = resolve(
  RUNTIME_VENV_DIR,
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const BACKEND_DIR = resolve(process.cwd(), 'glowmia-agent', 'backend');
const BACKEND_REQUIREMENTS = resolve(BACKEND_DIR, 'requirements.txt');
const BACKEND_OUT_LOG = resolve(process.cwd(), '.agent-runtime-backend.out.log');
const BACKEND_ERR_LOG = resolve(process.cwd(), '.agent-runtime-backend.err.log');
const RUNTIME_READY_MARKER = resolve(RUNTIME_VENV_DIR, '.glowmia-agent-ready');
const HEALTH_CHECK_TIMEOUT_MS = 1500;
const BACKEND_BOOT_TIMEOUT_MS = 45000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const EXTRA_BACKEND_PACKAGES = ['replicate'];

type RuntimeState = {
  startupPromise: Promise<void> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __glowmiaAgentRuntimeState: RuntimeState | undefined;
}

const runtimeState: RuntimeState =
  global.__glowmiaAgentRuntimeState ??
  (global.__glowmiaAgentRuntimeState = {
    startupPromise: null,
  });

function sleep(ms: number) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function isLocalBackendUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    return LOCAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isBackendHealthy(baseUrl: string) {
  try {
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/health`, { method: 'GET' }, HEALTH_CHECK_TIMEOUT_MS);
    return response.ok;
  } catch {
    return false;
  }
}

function execFileAsync(command: string, args: string[], cwd?: string) {
  return new Promise<void>((resolveExec, rejectExec) => {
    execFile(command, args, { cwd }, (error) => {
      if (error) {
        rejectExec(error);
        return;
      }

      resolveExec();
    });
  });
}

async function resolveSystemPythonCommand() {
  const configured = process.env.GLOWMIA_AGENT_PYTHON;
  const candidates: Array<{ command: string; args: string[] }> = [];

  if (configured) {
    candidates.push({ command: configured, args: [] });
  }

  if (process.platform === 'win32') {
    candidates.push(
      { command: 'py', args: ['-3.12'] },
      { command: 'py', args: ['-3'] },
      { command: 'python', args: [] },
    );
  } else {
    candidates.push(
      { command: 'python3', args: [] },
      { command: 'python', args: [] },
    );
  }

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, [...candidate.args, '--version']);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('No usable Python interpreter was found for the Glowmia agent backend.');
}

async function ensureRuntimePython() {
  if (existsSync(RUNTIME_PYTHON)) {
    return RUNTIME_PYTHON;
  }

  mkdirSync(RUNTIME_DIR, { recursive: true });

  const python = await resolveSystemPythonCommand();
  await execFileAsync(python.command, [...python.args, '-m', 'venv', RUNTIME_VENV_DIR], process.cwd());

  return RUNTIME_PYTHON;
}

async function installBackendDependencies(pythonPath: string) {
  if (existsSync(RUNTIME_READY_MARKER)) {
    return;
  }

  await execFileAsync(pythonPath, ['-m', 'pip', 'install', '-r', BACKEND_REQUIREMENTS, ...EXTRA_BACKEND_PACKAGES], process.cwd());
  writeFileSync(RUNTIME_READY_MARKER, `${Date.now()}\n`, 'utf8');
}

function spawnBackendProcess(pythonPath: string) {
  const stdoutFd = openSync(BACKEND_OUT_LOG, 'a');
  const stderrFd = openSync(BACKEND_ERR_LOG, 'a');

  const child = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    {
      cwd: BACKEND_DIR,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    },
  );

  child.unref();
}

async function waitForBackend(baseUrl: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendHealthy(baseUrl)) {
      return;
    }

    await sleep(1000);
  }

  throw new Error('Glowmia agent backend did not become healthy in time.');
}

async function startLocalBackend(baseUrl: string) {
  const pythonPath = await ensureRuntimePython();
  await installBackendDependencies(pythonPath);
  spawnBackendProcess(pythonPath);
  await waitForBackend(baseUrl, BACKEND_BOOT_TIMEOUT_MS);
}

export async function ensureGlowmiaAgentBackend(baseUrl: string) {
  if (!isLocalBackendUrl(baseUrl) || !existsSync(BACKEND_DIR)) {
    return;
  }

  if (await isBackendHealthy(baseUrl)) {
    return;
  }

  if (!runtimeState.startupPromise) {
    runtimeState.startupPromise = startLocalBackend(baseUrl).finally(() => {
      runtimeState.startupPromise = null;
    });
  }

  await runtimeState.startupPromise;
}
