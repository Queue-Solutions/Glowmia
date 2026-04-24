import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { isLocalAgentBackendUrl, isProductionLikeRuntime } from '@/src/lib/agentBackendConfig';

const RUNTIME_DIR = resolveRuntimeDirectory();
const BACKEND_DIR = resolveBundledBackendDirectory();
const BACKEND_RUNTIME_SLUG = basename(resolve(BACKEND_DIR, '..')).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
const RUNTIME_VENV_DIR = resolve(RUNTIME_DIR, `backend-venv-${BACKEND_RUNTIME_SLUG}`);
const RUNTIME_PYTHON = resolve(
  RUNTIME_VENV_DIR,
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const BACKEND_REQUIREMENTS = resolve(BACKEND_DIR, 'requirements.txt');
const BACKEND_OUT_LOG = resolve(RUNTIME_DIR, 'backend.out.log');
const BACKEND_ERR_LOG = resolve(RUNTIME_DIR, 'backend.err.log');
const RUNTIME_READY_MARKER = resolve(RUNTIME_VENV_DIR, `.glowmia-agent-ready-${BACKEND_RUNTIME_SLUG}`);
const HEALTH_CHECK_TIMEOUT_MS = 1500;
const BACKEND_BOOT_TIMEOUT_MS = 45000;
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

function resolveBundledBackendDirectory() {
  const candidates = [
    resolve(process.cwd(), 'Glowmia_Codex_Agent', 'backend'),
    resolve(process.cwd(), 'glowmia-agent', 'backend'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveRuntimeDirectory() {
  const configured = process.env.GLOWMIA_AGENT_RUNTIME_DIR?.trim();

  if (configured) {
    return configured;
  }

  if (isProductionLikeRuntime()) {
    return resolve('/tmp', 'agent-runtime');
  }

  return resolve(process.cwd(), '.agent-runtime');
}

function ensureRuntimeDirectory() {
  mkdirSync(RUNTIME_DIR, { recursive: true });
}

function parseLocalBackendTarget(baseUrl: string) {
  const parsed = new URL(baseUrl);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid local agent backend port in ${baseUrl}.`);
  }

  return {
    host: parsed.hostname,
    port: Math.round(port),
  };
}

function sleep(ms: number) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
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
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/v1/health`, { method: 'GET' }, HEALTH_CHECK_TIMEOUT_MS);
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

  ensureRuntimeDirectory();

  const python = await resolveSystemPythonCommand();
  await execFileAsync(python.command, [...python.args, '-m', 'venv', RUNTIME_VENV_DIR], process.cwd());

  return RUNTIME_PYTHON;
}

async function installBackendDependencies(pythonPath: string) {
  if (existsSync(RUNTIME_READY_MARKER)) {
    return;
  }

  ensureRuntimeDirectory();
  await execFileAsync(
    pythonPath,
    ['-m', 'pip', 'install', '-r', BACKEND_REQUIREMENTS, ...EXTRA_BACKEND_PACKAGES],
    process.cwd(),
  );
  writeFileSync(RUNTIME_READY_MARKER, `${Date.now()}\n`, 'utf8');
}

function spawnBackendProcess(pythonPath: string, baseUrl: string) {
  ensureRuntimeDirectory();
  const target = parseLocalBackendTarget(baseUrl);

  const stdoutFd = openSync(BACKEND_OUT_LOG, 'a');
  const stderrFd = openSync(BACKEND_ERR_LOG, 'a');

  const child = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'app.main:app', '--host', target.host, '--port', String(target.port)],
    {
      cwd: BACKEND_DIR,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      env: {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        SUPABASE_KEY:
          process.env.SUPABASE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          '',
        REPLICATE_MODEL: process.env.REPLICATE_MODEL || 'black-forest-labs/flux-kontext-pro',
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
  spawnBackendProcess(pythonPath, baseUrl);
  await waitForBackend(baseUrl, BACKEND_BOOT_TIMEOUT_MS);
}

export async function ensureGlowmiaAgentBackend(baseUrl: string) {
  if (isProductionLikeRuntime()) {
    return;
  }

  if (!isLocalAgentBackendUrl(baseUrl) || !existsSync(BACKEND_DIR)) {
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
