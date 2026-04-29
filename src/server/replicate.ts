type ReplicateHistoryMessage = {
  role: string;
  content: string;
};

type PredictionPayload = {
  input: Record<string, unknown>;
  version?: string;
};

const DEFAULT_REPLICATE_IMAGE_MODEL = 'black-forest-labs/flux-kontext-pro';
const DEFAULT_TIMEOUT_MS = 60000;
const REPLICATE_API_BASE_URL = 'https://api.replicate.com/v1';

function readEnv(value: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getReplicateToken() {
  return readEnv(process.env.REPLICATE_API_TOKEN);
}

function getReplicateLlmModel() {
  return readEnv(process.env.REPLICATE_LLM_MODEL);
}

function getReplicateImageModel() {
  return readEnv(process.env.REPLICATE_IMAGE_MODEL) || readEnv(process.env.REPLICATE_MODEL) || DEFAULT_REPLICATE_IMAGE_MODEL;
}

function requireReplicateToken() {
  const token = getReplicateToken();

  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured.');
  }

  return token;
}

function buildPredictionUrl(modelIdentifier: string) {
  if (modelIdentifier.includes(':')) {
    return `${REPLICATE_API_BASE_URL}/predictions`;
  }

  const [owner, name] = modelIdentifier.split('/', 2);

  if (!owner || !name) {
    throw new Error(`Invalid Replicate model identifier: ${modelIdentifier}`);
  }

  return `${REPLICATE_API_BASE_URL}/models/${owner}/${name}/predictions`;
}

async function replicateRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error((typeof data.detail === 'string' && data.detail) || (typeof data.error === 'string' && data.error) || `Replicate request failed with status ${response.status}.`);
  }

  return data;
}

async function createPrediction(modelIdentifier: string, payload: PredictionPayload) {
  const token = requireReplicateToken();
  const prediction = await replicateRequest(buildPredictionUrl(modelIdentifier), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify(payload),
  });

  let current = prediction;
  const startedAt = Date.now();

  while (!['succeeded', 'failed', 'canceled'].includes(String(current.status ?? ''))) {
    if (Date.now() - startedAt > DEFAULT_TIMEOUT_MS) {
      throw new Error('Replicate prediction timed out.');
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));

    current = await replicateRequest(`${REPLICATE_API_BASE_URL}/predictions/${current.id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  if (current.status !== 'succeeded') {
    throw new Error(`Replicate prediction did not succeed. Final status: ${String(current.status)}.`);
  }

  return current;
}

function buildPayload(modelIdentifier: string, input: Record<string, unknown>) {
  if (modelIdentifier.includes(':')) {
    return {
      version: modelIdentifier,
      input,
    } satisfies PredictionPayload;
  }

  return {
    input,
  } satisfies PredictionPayload;
}

export function isReplicateConfigured() {
  return Boolean(getReplicateToken());
}

export function hasReplicateTextModel() {
  return Boolean(getReplicateLlmModel() && getReplicateToken());
}

export function hasReplicateImageModel() {
  return Boolean(getReplicateImageModel() && getReplicateToken());
}

export async function generateText(input: {
  systemPrompt: string;
  userPrompt: string;
  history?: ReplicateHistoryMessage[];
}) {
  const modelIdentifier = getReplicateLlmModel();

  if (!modelIdentifier) {
    throw new Error('REPLICATE_LLM_MODEL is not configured.');
  }

  const prediction = await createPrediction(
    modelIdentifier,
    buildPayload(modelIdentifier, {
      system_prompt: input.systemPrompt,
      prompt: input.userPrompt,
      messages: input.history ?? [],
    }),
  );

  const output = prediction.output;

  if (Array.isArray(output)) {
    return output.map((chunk) => String(chunk)).join('').trim();
  }

  return String(output ?? '').trim();
}

export async function polishArabicText(text: string) {
  if (!text.trim()) {
    return text;
  }

  return generateText({
    systemPrompt:
      'You rewrite Arabic fashion-assistant replies into polished, natural Arabic. Preserve meaning exactly. Return only Arabic text.',
    userPrompt: `Rewrite this reply in polished Arabic only:\n${text}`,
  });
}

export async function editImage(input: {
  imageUrl: string;
  instruction: string;
  language: 'en' | 'ar';
}) {
  const modelIdentifier = getReplicateImageModel();
  let prompt = input.instruction.trim();

  if (!prompt) {
    throw new Error('Image edit instruction is required.');
  }

  if (input.language === 'ar' && hasReplicateTextModel()) {
    const translated = await generateText({
      systemPrompt:
        'Translate Arabic fashion image-edit instructions into precise English prompts for image editing models. Return only the translated instruction.',
      userPrompt: `Translate this Arabic edit request into concise English:\n${prompt}`,
    });

    if (translated.trim()) {
      prompt = translated.trim();
    }
  }

  const prediction = await createPrediction(
    modelIdentifier,
    buildPayload(modelIdentifier, {
      input_image: input.imageUrl,
      prompt: [
        'Edit the exact same dress shown in the source image and keep the same person, pose, framing, camera angle, lighting, and overall scene.',
        'Apply only the requested change and preserve every other visible detail unless the user explicitly asks to change it.',
        'Do not redesign the dress, do not alter unrelated areas, and do not introduce new garments, new people, or background changes.',
        `Requested change: ${prompt}`,
      ].join(' '),
      aspect_ratio: 'match_input_image',
      output_format: 'png',
      prompt_upsampling: false,
      safety_tolerance: 2,
    }),
  );

  const output = prediction.output;

  if (Array.isArray(output) && output.length > 0) {
    return String(output[output.length - 1]);
  }

  if (typeof output === 'string' && output.trim()) {
    return output.trim();
  }

  throw new Error('Replicate image edit did not return an output URL.');
}
