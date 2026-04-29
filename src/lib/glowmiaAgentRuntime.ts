import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';
import { isLocalAgentBackendUrl, isProductionLikeRuntime } from '@/src/lib/agentBackendConfig';

const RUNTIME_DIR = resolveRuntimeDirectory();
const BACKEND_DIR = resolveBundledBackendDirectory();
const BACKEND_OUT_LOG = resolve(RUNTIME_DIR, 'backend.out.log');
const BACKEND_ERR_LOG = resolve(RUNTIME_DIR, 'backend.err.log');
const RUNTIME_STATE_FILE = resolve(RUNTIME_DIR, 'backend-state.json');
const HEALTH_CHECK_TIMEOUT_MS = 1500;
const BACKEND_BOOT_TIMEOUT_MS = 45000;
const BACKEND_SHUTDOWN_TIMEOUT_MS = 10000;
const EXTRA_BACKEND_PACKAGES = ['replicate'];
const FINGERPRINTABLE_EXTENSIONS = new Set(['.py', '.txt', '.toml', '.json', '.yaml', '.yml']);
const IGNORED_BACKEND_DIRECTORIES = new Set(['.venv', '__pycache__', '.pytest_cache', '.mypy_cache']);

type RuntimeState = {
  startupPromise: Promise<void> | null;
};

type BackendRuntimeConfig = {
  backendDir: string;
  backendSlug: string;
  fingerprint: string;
  fingerprintShort: string;
  requirementsPath: string;
  readyMarkerPath: string;
  pythonPath: string;
  venvDir: string;
};

type RuntimeStateFile = {
  backendDir: string;
  baseUrl: string;
  fingerprint: string;
  pid: number | null;
  pythonPath: string;
  startedAt: string;
  venvDir: string;
};

type HealthResponse = {
  backend_path?: unknown;
  runtime_fingerprint?: unknown;
  status?: unknown;
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

function isDevelopmentRuntime() {
  return !isProductionLikeRuntime();
}

function logRuntime(message: string, details?: Record<string, unknown>) {
  if (!isDevelopmentRuntime()) {
    return;
  }

  if (details) {
    console.info(`[agent.runtime] ${message}`, details);
    return;
  }

  console.info(`[agent.runtime] ${message}`);
}

function resolveBundledBackendDirectory() {
  return resolve(process.cwd(), 'Glowmia_Agent', 'backend');
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

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

async function readBackendHealth(baseUrl: string) {
  try {
    const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/v1/health`, { method: 'GET' }, HEALTH_CHECK_TIMEOUT_MS);
    const text = await response.text();
    const data = text ? (JSON.parse(text) as HealthResponse) : null;

    return {
      ok: response.ok,
      data,
    };
  } catch {
    return {
      ok: false,
      data: null,
    };
  }
}

function healthFingerprintMatches(health: Awaited<ReturnType<typeof readBackendHealth>>, fingerprint: string) {
  return health.ok && readString(health.data?.runtime_fingerprint) === fingerprint;
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

function listFingerprintFiles(directory: string, root = directory): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_BACKEND_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...listFingerprintFiles(absolutePath, root));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!FINGERPRINTABLE_EXTENSIONS.has(extname(entry.name).toLowerCase()) && entry.name !== 'requirements.txt') {
      continue;
    }

    files.push(relative(root, absolutePath));
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function computeBackendFingerprint(backendDir: string) {
  const hash = createHash('sha256');
  hash.update(`extra-packages:${EXTRA_BACKEND_PACKAGES.join(',')}`);

  for (const relativePath of listFingerprintFiles(backendDir)) {
    const absolutePath = resolve(backendDir, relativePath);
    hash.update(`file:${relativePath}`);
    hash.update(readFileSync(absolutePath));
  }

  return hash.digest('hex');
}

function resolveBackendRuntimeConfig(): BackendRuntimeConfig {
  const backendSlug = basename(resolve(BACKEND_DIR, '..')).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const fingerprint = computeBackendFingerprint(BACKEND_DIR);
  const fingerprintShort = fingerprint.slice(0, 12);
  const venvDir = resolve(RUNTIME_DIR, `backend-venv-${backendSlug}-${fingerprintShort}`);
  const pythonPath = resolve(
    venvDir,
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );

  return {
    backendDir: BACKEND_DIR,
    backendSlug,
    fingerprint,
    fingerprintShort,
    requirementsPath: resolve(BACKEND_DIR, 'requirements.txt'),
    readyMarkerPath: resolve(venvDir, `.glowmia-agent-ready-${backendSlug}-${fingerprintShort}`),
    pythonPath,
    venvDir,
  };
}

function readRuntimeStateFile() {
  if (!existsSync(RUNTIME_STATE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(RUNTIME_STATE_FILE, 'utf8')) as RuntimeStateFile;
  } catch {
    return null;
  }
}

function writeRuntimeStateFile(state: RuntimeStateFile) {
  ensureRuntimeDirectory();
  writeFileSync(RUNTIME_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearRuntimeStateFile() {
  if (!existsSync(RUNTIME_STATE_FILE)) {
    return;
  }

  try {
    unlinkSync(RUNTIME_STATE_FILE);
  } catch {
    // Ignore cleanup failures in development.
  }
}

function pidExists(pid: number | null | undefined) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }

  process.kill(-pid, 'SIGTERM');
}

async function stopTrackedBackend(reason: string) {
  const runtimeStateFile = readRuntimeStateFile();

  if (!runtimeStateFile?.pid) {
    clearRuntimeStateFile();
    return false;
  }

  if (!pidExists(runtimeStateFile.pid)) {
    clearRuntimeStateFile();
    return false;
  }

  logRuntime(`Stopping tracked backend process ${runtimeStateFile.pid}.`, {
    reason,
    fingerprint: runtimeStateFile.fingerprint,
  });

  await killProcessTree(runtimeStateFile.pid);
  clearRuntimeStateFile();
  return true;
}

async function waitForBackendShutdown(baseUrl: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const health = await readBackendHealth(baseUrl);

    if (!health.ok) {
      return;
    }

    await sleep(500);
  }
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

async function ensureRuntimePython(config: BackendRuntimeConfig) {
  if (existsSync(config.pythonPath)) {
    return {
      created: false,
      pythonPath: config.pythonPath,
    };
  }

  ensureRuntimeDirectory();

  const python = await resolveSystemPythonCommand();
  await execFileAsync(python.command, [...python.args, '-m', 'venv', config.venvDir], process.cwd());

  return {
    created: true,
    pythonPath: config.pythonPath,
  };
}

async function installBackendDependencies(config: BackendRuntimeConfig, pythonPath: string) {
  if (existsSync(config.readyMarkerPath)) {
    return false;
  }

  ensureRuntimeDirectory();
  await execFileAsync(
    pythonPath,
    ['-m', 'pip', 'install', '-r', config.requirementsPath, ...EXTRA_BACKEND_PACKAGES],
    process.cwd(),
  );
  writeFileSync(config.readyMarkerPath, `${config.fingerprint}\n`, 'utf8');
  return true;
}

function spawnBackendProcess(config: BackendRuntimeConfig, pythonPath: string, baseUrl: string) {
  ensureRuntimeDirectory();
  const target = parseLocalBackendTarget(baseUrl);

  const stdoutFd = openSync(BACKEND_OUT_LOG, 'a');
  const stderrFd = openSync(BACKEND_ERR_LOG, 'a');

  const child = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'app.main:app', '--host', target.host, '--port', String(target.port)],
    {
      cwd: config.backendDir,
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      env: {
        ...process.env,
        GLOWMIA_AGENT_BACKEND_FINGERPRINT: config.fingerprint,
        GLOWMIA_AGENT_BACKEND_PATH: config.backendDir,
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
  return child.pid ?? null;
}

async function waitForBackendCurrent(baseUrl: string, fingerprint: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const health = await readBackendHealth(baseUrl);

    if (healthFingerprintMatches(health, fingerprint)) {
      return;
    }

    await sleep(1000);
  }

  throw new Error('Glowmia agent backend did not become healthy with the current fingerprint in time.');
}

async function startLocalBackend(baseUrl: string) {
  const config = resolveBackendRuntimeConfig();
  const runtimePython = await ensureRuntimePython(config);
  const installedDependencies = await installBackendDependencies(config, runtimePython.pythonPath);
  const pid = spawnBackendProcess(config, runtimePython.pythonPath, baseUrl);

  writeRuntimeStateFile({
    backendDir: config.backendDir,
    baseUrl,
    fingerprint: config.fingerprint,
    pid,
    pythonPath: runtimePython.pythonPath,
    startedAt: new Date().toISOString(),
    venvDir: config.venvDir,
  });

  logRuntime('Starting local Glowmia backend.', {
    backendPath: config.backendDir,
    fingerprint: config.fingerprintShort,
    installedDependencies,
    pid,
    recreatedVenv: runtimePython.created,
    runtimePath: RUNTIME_DIR,
    venvPath: config.venvDir,
  });

  await waitForBackendCurrent(baseUrl, config.fingerprint, BACKEND_BOOT_TIMEOUT_MS);
}

export async function ensureGlowmiaAgentBackend(baseUrl: string) {
  if (isProductionLikeRuntime()) {
    return;
  }

  if (!isLocalAgentBackendUrl(baseUrl) || !existsSync(BACKEND_DIR)) {
    return;
  }

  const config = resolveBackendRuntimeConfig();
  const health = await readBackendHealth(baseUrl);

  logRuntime('Resolved local runtime configuration.', {
    backendPath: config.backendDir,
    fingerprint: config.fingerprintShort,
    runtimePath: RUNTIME_DIR,
    venvPath: config.venvDir,
  });

  if (healthFingerprintMatches(health, config.fingerprint)) {
    logRuntime('Reusing current local backend runtime.', {
      baseUrl,
      fingerprint: config.fingerprintShort,
    });
    return;
  }

  if (health.ok) {
    const runningFingerprint = readString(health.data?.runtime_fingerprint) || 'unknown';
    const stopped = await stopTrackedBackend('backend source or requirements changed');

    await waitForBackendShutdown(baseUrl, BACKEND_SHUTDOWN_TIMEOUT_MS);

    if (!stopped) {
      throw new Error(
        `A stale local Glowmia backend is already running at ${baseUrl}. Current fingerprint ${config.fingerprintShort}, running fingerprint ${runningFingerprint}. Run "npm run agent:reset" and start again.`,
      );
    }
  }

  if (!runtimeState.startupPromise) {
    runtimeState.startupPromise = startLocalBackend(baseUrl).finally(() => {
      runtimeState.startupPromise = null;
    });
  }

  await runtimeState.startupPromise;
}
