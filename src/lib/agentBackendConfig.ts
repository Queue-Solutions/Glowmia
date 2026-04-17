const DEVELOPMENT_LOCAL_AGENT_BACKEND_URL = 'http://127.0.0.1:8000';
const LOCAL_AGENT_BACKEND_HOSTS = new Set(['127.0.0.1', 'localhost']);
const DEFAULT_AGENT_PROXY_TIMEOUT_MS = 20000;

type AgentBackendEnvSource =
  | 'AGENT_BACKEND_URL'
  | 'GLOWMIA_AGENT_API_URL'
  | 'NEXT_PUBLIC_AGENT_BACKEND_URL'
  | 'NEXT_PUBLIC_GLOWMIA_AGENT_API_URL'
  | 'development-fallback';

export type AgentBackendConfig = {
  baseUrl: string;
  source: AgentBackendEnvSource;
  isLocal: boolean;
  isProductionLike: boolean;
};

function readConfiguredValue(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeBackendUrl(value: string, source: AgentBackendEnvSource) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${source} must be a valid absolute URL, for example https://agent.example.com.`);
  }

  return parsed.toString().replace(/\/$/, '');
}

export function isProductionLikeRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function isLocalAgentBackendUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    return LOCAL_AGENT_BACKEND_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveAgentBackendConfig(): AgentBackendConfig {
  const configuredSources: Array<{ source: AgentBackendEnvSource; value: string }> = [
    { source: 'AGENT_BACKEND_URL', value: readConfiguredValue(process.env.AGENT_BACKEND_URL) },
    { source: 'GLOWMIA_AGENT_API_URL', value: readConfiguredValue(process.env.GLOWMIA_AGENT_API_URL) },
    { source: 'NEXT_PUBLIC_AGENT_BACKEND_URL', value: readConfiguredValue(process.env.NEXT_PUBLIC_AGENT_BACKEND_URL) },
    { source: 'NEXT_PUBLIC_GLOWMIA_AGENT_API_URL', value: readConfiguredValue(process.env.NEXT_PUBLIC_GLOWMIA_AGENT_API_URL) },
  ];

  for (const candidate of configuredSources) {
    if (!candidate.value) {
      continue;
    }

    const baseUrl = normalizeBackendUrl(candidate.value, candidate.source);
    const isLocal = isLocalAgentBackendUrl(baseUrl);

    if (isProductionLikeRuntime() && isLocal) {
      throw new Error(
        `${candidate.source} points to ${baseUrl}, which is not valid in production. Set AGENT_BACKEND_URL to the public FastAPI backend URL.`,
      );
    }

    return {
      baseUrl,
      source: candidate.source,
      isLocal,
      isProductionLike: isProductionLikeRuntime(),
    };
  }

  if (isProductionLikeRuntime()) {
    throw new Error(
      'Missing AGENT_BACKEND_URL. Set AGENT_BACKEND_URL to the public Glowmia FastAPI backend URL in Vercel.',
    );
  }

  return {
    baseUrl: DEVELOPMENT_LOCAL_AGENT_BACKEND_URL,
    source: 'development-fallback',
    isLocal: true,
    isProductionLike: false,
  };
}

export function getAgentProxyTimeoutMs() {
  const raw = Number(process.env.AGENT_PROXY_TIMEOUT_MS ?? DEFAULT_AGENT_PROXY_TIMEOUT_MS);

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_AGENT_PROXY_TIMEOUT_MS;
  }

  return Math.min(Math.round(raw), 60000);
}
