import { getAgentProxyTimeoutMs, resolveAgentBackendConfig } from '@/src/lib/agentBackendConfig';
import { ensureGlowmiaAgentBackend } from '@/src/lib/glowmiaAgentRuntime';
import {
  editImage,
  generateText,
  hasReplicateImageModel,
  hasReplicateTextModel,
  polishArabicText,
} from '@/src/server/replicate';
import { requireServerSupabaseAdminClient } from '@/src/server/supabase';

export type AgentLanguage = 'en' | 'ar';
export type AgentTool = 'llm' | 'recommend' | 'edit' | 'styling';
export type AgentIntent = 'recommend' | 'styling' | 'edit' | 'chat';
export type AgentModeHint = 'recommend' | 'edit' | 'styling' | 'chat';

export type AgentDress = {
  id: string;
  name: string;
  name_ar?: string | null;
  image_url?: string | null;
  detail_image_url?: string | null;
  front_view_url?: string | null;
  back_view_url?: string | null;
  side_view_url?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  occasion?: string[] | string | null;
  color?: string | null;
  sleeve_type?: string | null;
  length?: string | null;
  style?: string[] | string | null;
  fabric?: string | null;
  fit?: string | null;
  description?: string | null;
  description_ar?: string | null;
  color_ar?: string | null;
  sleeve_type_ar?: string | null;
  length_ar?: string | null;
  fabric_ar?: string | null;
  fit_ar?: string | null;
  occasion_ar?: string[] | string | null;
  style_ar?: string[] | string | null;
};

export type AgentSessionResponse = {
  session_id: string;
  language: AgentLanguage;
};

export type AgentChatResponse = {
  session_id: string;
  tool: AgentTool;
  intent: AgentIntent;
  language: AgentLanguage;
  message: string;
  dresses: AgentDress[];
  edited_image_url?: string | null;
  selected_dress_id?: string | null;
};

type AgentMessageRequest = {
  sessionId: string;
  message: string;
  language: AgentLanguage;
  selectedDressId?: string | null;
  selectedDressImageUrl?: string | null;
  modeHint?: AgentModeHint | null;
};

type SessionMessageRow = {
  role?: string | null;
  text?: string | null;
  message_type?: string | null;
  dress_id?: string | null;
  image_url?: string | null;
  edited_image_url?: string | null;
  parsed_data?: unknown;
  metadata?: unknown;
  created_at?: string | null;
};

type AgentSessionState = {
  id: string;
  language: AgentLanguage;
  selectedDressId: string | null;
  currentImageUrl: string | null;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    messageType: string;
    dressId: string | null;
    imageUrl: string | null;
    editedImageUrl: string | null;
    parsedData: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>;
};

const CHAT_SESSIONS_TABLE = 'chat_sessions';
const CHAT_MESSAGES_TABLE = 'chat_messages';
const DRESSES_TABLE = 'dresses';
const MAX_AGENT_DRESSES = 4;
const MAX_SESSION_MESSAGES = 50;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNullableString(value: unknown) {
  const normalized = readString(value);
  return normalized || null;
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  const single = readString(value);
  return single ? [single] : [];
}

function normalizeJsonRecord(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function containsArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function createSessionTitle(language: AgentLanguage) {
  return language === 'ar' ? 'جلسة Glowmia' : 'Glowmia Session';
}

function inferLanguageFromSessionTitle(title: string): AgentLanguage {
  return containsArabic(title) ? 'ar' : 'en';
}

function mapHistory(messages: AgentSessionState['messages']) {
  return messages.slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function localizeField(row: Record<string, unknown>, field: string, language: AgentLanguage) {
  const primary = language === 'ar' ? row[`${field}_ar`] : row[field];
  const fallback = language === 'ar' ? row[field] : row[`${field}_ar`];
  const primaryList = normalizeList(primary);
  const fallbackList = normalizeList(fallback);

  if (primaryList.length > 0) {
    return primaryList.length === 1 ? primaryList[0] : primaryList;
  }

  if (fallbackList.length > 0) {
    return fallbackList.length === 1 ? fallbackList[0] : fallbackList;
  }

  return null;
}

function mapDressRow(row: Record<string, unknown>, language: AgentLanguage): AgentDress {
  const frontViewUrl = readNullableString(row.front_view_url) || readNullableString(row.image_url) || readNullableString(row.cover_image_url);

  return {
    id: readString(row.id),
    name:
      (typeof localizeField(row, 'name', language) === 'string' ? (localizeField(row, 'name', language) as string) : '') ||
      'Glowmia Dress',
    name_ar: readNullableString(row.name_ar),
    image_url: frontViewUrl,
    detail_image_url: readNullableString(row.image_url),
    front_view_url: readNullableString(row.front_view_url) || frontViewUrl,
    back_view_url: readNullableString(row.back_view_url),
    side_view_url: readNullableString(row.side_view_url),
    cover_image_url: readNullableString(row.cover_image_url) || frontViewUrl,
    category: readNullableString(row.category),
    occasion: localizeField(row, 'occasion', language),
    color: typeof localizeField(row, 'color', language) === 'string' ? (localizeField(row, 'color', language) as string) : null,
    sleeve_type:
      typeof localizeField(row, 'sleeve_type', language) === 'string' ? (localizeField(row, 'sleeve_type', language) as string) : null,
    length: typeof localizeField(row, 'length', language) === 'string' ? (localizeField(row, 'length', language) as string) : null,
    style: localizeField(row, 'style', language),
    fabric: typeof localizeField(row, 'fabric', language) === 'string' ? (localizeField(row, 'fabric', language) as string) : null,
    fit: typeof localizeField(row, 'fit', language) === 'string' ? (localizeField(row, 'fit', language) as string) : null,
    description:
      typeof localizeField(row, 'description', language) === 'string' ? (localizeField(row, 'description', language) as string) : null,
    description_ar: readNullableString(row.description_ar),
    color_ar: readNullableString(row.color_ar),
    sleeve_type_ar: readNullableString(row.sleeve_type_ar),
    length_ar: readNullableString(row.length_ar),
    fabric_ar: readNullableString(row.fabric_ar),
    fit_ar: readNullableString(row.fit_ar),
    occasion_ar: row.occasion_ar as AgentDress['occasion_ar'],
    style_ar: row.style_ar as AgentDress['style_ar'],
  };
}

function tokenize(message: string) {
  return message
    .toLowerCase()
    .replace(/[,،]/g, ' ')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
}

function extractFilters(message: string) {
  const lowered = message.toLowerCase();
  const filters: Record<string, string> = {};
  const keywords: Record<string, Record<string, string>> = {
    occasion: {
      wedding: 'wedding',
      party: 'party',
      casual: 'casual',
      formal: 'formal',
      evening: 'evening',
      work: 'work',
      حفلة: 'party',
      حفله: 'party',
      حفلات: 'party',
      زفاف: 'wedding',
      عرس: 'wedding',
      كاجوال: 'casual',
      رسمي: 'formal',
      سهرة: 'evening',
      مسائي: 'evening',
      للعمل: 'work',
    },
    color: {
      black: 'black',
      white: 'white',
      red: 'red',
      green: 'green',
      blue: 'blue',
      pink: 'pink',
      gold: 'gold',
      silver: 'silver',
      burgundy: 'burgundy',
      cream: 'cream',
      blush: 'blush',
      أسود: 'black',
      اسود: 'black',
      أبيض: 'white',
      ابيض: 'white',
      أحمر: 'red',
      احمر: 'red',
      أخضر: 'green',
      اخضر: 'green',
      أزرق: 'blue',
      ازرق: 'blue',
      وردي: 'pink',
      ذهبي: 'gold',
      فضي: 'silver',
      عنابي: 'burgundy',
      كريمي: 'cream',
      'أوف وايت': 'cream',
      'اوف وايت': 'cream',
      بلش: 'blush',
    },
    sleeve_type: {
      sleeveless: 'sleeveless',
      'long sleeve': 'long sleeve',
      'short sleeve': 'short sleeve',
      'one shoulder': 'one shoulder',
      'off shoulder': 'off shoulder',
      'بدون أكمام': 'sleeveless',
      'بدون اكمام': 'sleeveless',
      'كم طويل': 'long sleeve',
      'كم قصير': 'short sleeve',
      'كتف واحدة': 'one shoulder',
      'أكتاف مكشوفة': 'off shoulder',
    },
    length: {
      mini: 'mini',
      midi: 'midi',
      maxi: 'maxi',
      قصير: 'mini',
      متوسط: 'midi',
      طويل: 'maxi',
      ماكسي: 'maxi',
      ميدي: 'midi',
    },
  };

  for (const [field, options] of Object.entries(keywords)) {
    for (const [token, canonical] of Object.entries(options)) {
      if (lowered.includes(token.toLowerCase())) {
        filters[field] = canonical;
        break;
      }
    }
  }

  return filters;
}

function buildRowSearchText(row: Record<string, unknown>) {
  const fields = [
    'name',
    'name_ar',
    'description',
    'description_ar',
    'color',
    'color_ar',
    'fabric',
    'fabric_ar',
    'fit',
    'fit_ar',
    'sleeve_type',
    'sleeve_type_ar',
    'length',
    'length_ar',
    'category',
    'occasion',
    'occasion_ar',
    'style',
    'style_ar',
  ];

  return fields
    .flatMap((field) => normalizeList(row[field]))
    .join(' ')
    .toLowerCase();
}

function valueContains(value: unknown, expected: string) {
  if (Array.isArray(value)) {
    return value.some((entry) => String(entry).toLowerCase().includes(expected.toLowerCase()));
  }

  return String(value ?? '').toLowerCase().includes(expected.toLowerCase());
}

function valueEquals(value: unknown, expected: string) {
  if (Array.isArray(value)) {
    return value.some((entry) => String(entry).trim().toLowerCase() === expected.trim().toLowerCase());
  }

  return String(value ?? '').trim().toLowerCase() === expected.trim().toLowerCase();
}

function colorMatches(value: unknown, expected: string) {
  const aliases: Record<string, Set<string>> = {
    white: new Set(['white', 'cream', 'off white', 'off-white', 'silver', 'أبيض', 'ابيض', 'أوف وايت', 'اوف وايت', 'كريمي', 'فضي']),
    cream: new Set(['cream', 'off white', 'off-white', 'white', 'كريمي', 'أوف وايت', 'اوف وايت', 'أبيض', 'ابيض']),
    silver: new Set(['silver', 'white', 'فضي', 'أبيض', 'ابيض']),
    red: new Set(['red', 'burgundy', 'أحمر', 'احمر', 'عنابي']),
    burgundy: new Set(['burgundy', 'red', 'عنابي', 'أحمر', 'احمر']),
  };

  const normalizedExpected = expected.trim().toLowerCase();
  const accepted = aliases[normalizedExpected] || new Set([normalizedExpected]);
  const values = Array.isArray(value) ? value : [value];

  return values.some((entry) => accepted.has(String(entry ?? '').trim().toLowerCase()));
}

function scoreDressRow(row: Record<string, unknown>, filters: Record<string, string>, tokens: string[]) {
  let score = 0;
  const searchText = buildRowSearchText(row);

  for (const [field, expected] of Object.entries(filters)) {
    const exactMatch =
      field === 'color'
        ? colorMatches(row[field], expected) || colorMatches(row[`${field}_ar`], expected)
        : valueEquals(row[field], expected) || valueEquals(row[`${field}_ar`], expected);
    const fuzzyMatch = valueContains(row[field], expected) || valueContains(row[`${field}_ar`], expected);

    if (exactMatch) {
      score += field === 'color' ? 30 : 8;
    } else if (fuzzyMatch) {
      score += field === 'color' ? 15 : 3;
    }
  }

  for (const token of tokens) {
    if (searchText.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function matchesRequiredFilters(row: Record<string, unknown>, filters: Record<string, string>) {
  const strictFields = new Set(['color', 'occasion', 'length', 'sleeve_type']);

  for (const [field, expected] of Object.entries(filters)) {
    if (!strictFields.has(field)) {
      continue;
    }

    const matches =
      field === 'color'
        ? colorMatches(row[field], expected) || colorMatches(row[`${field}_ar`], expected)
        : valueEquals(row[field], expected) ||
          valueEquals(row[`${field}_ar`], expected) ||
          valueContains(row[field], expected) ||
          valueContains(row[`${field}_ar`], expected);

    if (!matches) {
      return false;
    }
  }

  return true;
}

async function listDressRows() {
  const supabase = requireServerSupabaseAdminClient();
  const { data, error } = await supabase.from(DRESSES_TABLE).select('*').limit(40);

  if (error) {
    throw new Error(error.message || 'Unable to load dresses from Supabase.');
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) => readString(row.id));
}

async function getDressRowById(dressId: string) {
  const supabase = requireServerSupabaseAdminClient();
  const { data, error } = await supabase.from(DRESSES_TABLE).select('*').eq('id', dressId).limit(1);

  if (error) {
    throw new Error(error.message || 'Unable to load dress from Supabase.');
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return rows[0] ?? null;
}

function isLikelyEditInstruction(message: string) {
  const normalized = message.toLowerCase();
  return [
    'edit',
    'modify',
    'retouch',
    'make it',
    'change the',
    'change this',
    'change that',
    'add ',
    'remove ',
    'replace ',
    'turn it',
    'اجعل',
    'خليه',
    'عدلي',
    'أضيفي',
    'اضيفي',
    'شيل',
    'غيري',
    'غيّري',
    'غير ',
  ].some((token) => normalized.includes(token));
}

function isLikelyRecommendationRequest(message: string) {
  const normalized = message.toLowerCase();
  return [
    'recommend',
    'show me',
    'looking for',
    'i need a dress',
    'suggest',
    'dress for',
    'اعرضي',
    'اقترحي',
    'أريد فستان',
    'اريد فستان',
    'أبغى فستان',
    'ابغى فستان',
  ].some((token) => normalized.includes(token));
}

function isLikelyStylingRequest(message: string) {
  const normalized = message.toLowerCase();
  return [
    'style this',
    'how should i style',
    'what goes with',
    'accessories',
    'shoes',
    'bag',
    'jewelry',
    'نسق',
    'نسقي',
    'اكسسوارات',
    'حذاء',
    'شنطة',
    'مجوهرات',
    'يلبق معه',
  ].some((token) => normalized.includes(token));
}

async function detectIntent(input: {
  message: string;
  language: AgentLanguage;
  hasSelectedDress: boolean;
  modeHint?: AgentModeHint | null;
}): Promise<AgentIntent> {
  if (input.modeHint === 'edit' && input.hasSelectedDress) {
    return 'edit';
  }

  if (input.hasSelectedDress && isLikelyEditInstruction(input.message)) {
    return 'edit';
  }

  if (isLikelyRecommendationRequest(input.message) || Object.keys(extractFilters(input.message)).length > 0) {
    return 'recommend';
  }

  if (input.hasSelectedDress && isLikelyStylingRequest(input.message)) {
    return 'styling';
  }

  if (hasReplicateTextModel()) {
    const prompt = input.language === 'ar'
      ? [
          'Classify the intent as exactly one of: recommend, styling, edit, chat.',
          'recommend = asking for dress suggestions or options.',
          'styling = asking how to style or accessorize a dress without changing the image.',
          'edit = asking to visually modify the selected dress image itself.',
          'chat = general conversation.',
          `User message: ${input.message}`,
        ].join('\n')
      : [
          'Classify the intent as exactly one of: recommend, styling, edit, chat.',
          'recommend = asking for dress suggestions or options.',
          'styling = asking how to style or accessorize a dress without changing the image.',
          'edit = asking to visually modify the selected dress image itself.',
          'chat = general conversation.',
          `User message: ${input.message}`,
        ].join('\n');

    try {
      const result = await generateText({
        systemPrompt:
          'You classify fashion-assistant user intents. Choose exactly one label from: recommend, styling, edit, chat. Return only that single label.',
        userPrompt: prompt,
      });
      const normalized = result.toLowerCase().replace(/[.\-:]/g, ' ').trim().split(/\s+/)[0]?.trim();

      if (normalized === 'recommend' || normalized === 'styling' || normalized === 'edit' || normalized === 'chat') {
        return normalized;
      }
    } catch (error) {
      console.warn('[agent.local] Intent classification fallback triggered', error);
    }
  }

  return 'chat';
}

async function createSessionState(language: AgentLanguage) {
  const supabase = requireServerSupabaseAdminClient();
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const { error } = await supabase.from(CHAT_SESSIONS_TABLE).insert({
    id: sessionId,
    title: createSessionTitle(language),
    status: 'active',
    last_message_at: now,
  });

  if (error) {
    throw new Error(error.message || 'Unable to create chat session.');
  }

  return {
    session_id: sessionId,
    language,
  } satisfies AgentSessionResponse;
}

async function loadSessionState(sessionId: string) {
  const supabase = requireServerSupabaseAdminClient();
  const sessionResponse = await supabase.from(CHAT_SESSIONS_TABLE).select('*').eq('id', sessionId).limit(1);

  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message || 'Unable to load chat session.');
  }

  const sessionRow = ((sessionResponse.data as Array<Record<string, unknown>> | null) ?? [])[0];

  if (!sessionRow) {
    return null;
  }

  const messagesResponse = await supabase
    .from(CHAT_MESSAGES_TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(MAX_SESSION_MESSAGES);

  if (messagesResponse.error) {
    throw new Error(messagesResponse.error.message || 'Unable to load chat history.');
  }

  const rows = (messagesResponse.data as SessionMessageRow[] | null) ?? [];
  let selectedDressId: string | null = null;
  let currentImageUrl: string | null = null;

  for (const row of rows.slice().reverse()) {
    if (!selectedDressId && readString(row.dress_id)) {
      selectedDressId = readString(row.dress_id);
    }

    if (!currentImageUrl) {
      currentImageUrl = readNullableString(row.edited_image_url) || readNullableString(row.image_url);
    }

    if (selectedDressId && currentImageUrl) {
      break;
    }
  }

  return {
    id: sessionId,
    language: inferLanguageFromSessionTitle(readString(sessionRow.title)),
    selectedDressId,
    currentImageUrl,
    messages: rows.map((row) => ({
      role: (readString(row.role) as 'system' | 'user' | 'assistant') || 'assistant',
      content: readString(row.text),
      messageType: readString(row.message_type) || 'chat',
      dressId: readNullableString(row.dress_id),
      imageUrl: readNullableString(row.image_url),
      editedImageUrl: readNullableString(row.edited_image_url),
      parsedData: normalizeJsonRecord(row.parsed_data),
      metadata: normalizeJsonRecord(row.metadata),
    })),
  } satisfies AgentSessionState;
}

async function appendSessionMessage(
  sessionId: string,
  message: {
    role: 'system' | 'user' | 'assistant';
    content: string;
    messageType: string;
    dressId?: string | null;
    imageUrl?: string | null;
    editedImageUrl?: string | null;
    parsedData?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const supabase = requireServerSupabaseAdminClient();
  const now = new Date().toISOString();

  const insertResponse = await supabase.from(CHAT_MESSAGES_TABLE).insert({
    session_id: sessionId,
    role: message.role,
    message_type: message.messageType,
    text: message.content || null,
    dress_id: message.dressId || null,
    image_url: message.imageUrl || null,
    edited_image_url: message.editedImageUrl || null,
    parsed_data: message.parsedData || null,
    metadata: message.metadata || null,
  });

  if (insertResponse.error) {
    throw new Error(insertResponse.error.message || 'Unable to save chat message.');
  }

  const updateResponse = await supabase
    .from(CHAT_SESSIONS_TABLE)
    .update({ updated_at: now, last_message_at: now })
    .eq('id', sessionId);

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message || 'Unable to update chat session.');
  }
}

async function recommendDresses(message: string, language: AgentLanguage) {
  const filters = extractFilters(message);
  const tokens = tokenize(message);
  let rows = await listDressRows();

  if (Object.keys(filters).length > 0) {
    const strict = rows.filter((row) => matchesRequiredFilters(row, filters));

    if (strict.length > 0) {
      rows = strict;
    }
  }

  const ranked = rows
    .map((row) => ({
      row,
      score: scoreDressRow(row, filters, tokens),
    }))
    .sort((left, right) => right.score - left.score);

  const filtered = Object.keys(filters).length > 0 || tokens.length > 0 ? ranked.filter((item) => item.score > 0) : ranked;
  return filtered.slice(0, MAX_AGENT_DRESSES).map((item) => mapDressRow(item.row, language));
}

function buildSystemPrompt(language: AgentLanguage) {
  if (language === 'ar') {
    return [
      'You are Glowmia, an elegant AI fashion assistant for dresses.',
      'Reply only in polished natural Arabic unless the user clearly switches languages.',
      'Keep the tone premium, warm, and concise.',
    ].join(' ');
  }

  return [
    'You are Glowmia, an elegant AI fashion assistant for dresses.',
    'Reply in polished natural English with a premium, warm tone.',
  ].join(' ');
}

async function createChatReply(session: AgentSessionState, input: AgentMessageRequest, intent: AgentIntent) {
  if (hasReplicateTextModel()) {
    const systemPrompt = buildSystemPrompt(input.language);
    const userPrompt =
      intent === 'styling'
        ? `Provide practical styling advice for this request:\n${input.message}`
        : `Reply as Glowmia Stylist to this message:\n${input.message}`;

    const reply = await generateText({
      systemPrompt,
      userPrompt,
      history: mapHistory(session.messages),
    });

    if (input.language === 'ar') {
      return (await polishArabicText(reply)).trim() || reply;
    }

    return reply.trim();
  }

  if (intent === 'styling') {
    return input.language === 'ar'
      ? 'يمكنني تنسيق هذه الإطلالة مع أقراط ناعمة، حقيبة صغيرة أنيقة، وحذاء بسيط يبرز الفستان بدون مبالغة.'
      : 'I would style this look with refined earrings, a compact evening bag, and clean shoes that let the dress stay the focus.';
  }

  return input.language === 'ar'
    ? 'أهلًا بك في Glowmia. أخبريني عن المناسبة أو اللون أو القصة التي تريدينها وسأبدأ فورًا.'
    : 'Hello from Glowmia. Tell me the occasion, color, or silhouette you want and I will start from there.';
}

async function buildRecommendationResponse(session: AgentSessionState, input: AgentMessageRequest) {
  const dresses = await recommendDresses(input.message, input.language);
  const message =
    input.language === 'ar'
      ? 'هذه بعض الفساتين المناسبة من المجموعة الحالية. أستطيع تضييقها أكثر حسب اللون أو المناسبة أو القصة إذا أردتِ.'
      : 'Here are a few dress options from the current catalog. I can narrow them further by color, occasion, silhouette, or fabric if you want.';

  await appendSessionMessage(session.id, {
    role: 'assistant',
    content: message,
    messageType: 'recommend_result',
    metadata: {
      results: dresses,
    },
    parsedData: {
      filters: extractFilters(input.message),
      tokens: tokenize(input.message),
    },
  });

  return {
    session_id: session.id,
    tool: 'recommend',
    intent: 'recommend',
    language: input.language,
    message,
    dresses,
    selected_dress_id: input.selectedDressId || session.selectedDressId || null,
  } satisfies AgentChatResponse;
}

async function buildEditResponse(session: AgentSessionState, input: AgentMessageRequest) {
  const sourceImage = input.selectedDressImageUrl || session.currentImageUrl;

  if (!sourceImage) {
    const message =
      input.language === 'ar'
        ? 'من فضلك اختاري فستانًا أولًا حتى أعدل نفس الصورة.'
        : 'Please select a dress first so I can edit that same image.';

    await appendSessionMessage(session.id, {
      role: 'assistant',
      content: message,
      messageType: 'edit_result',
      dressId: input.selectedDressId || session.selectedDressId || null,
    });

    return {
      session_id: session.id,
      tool: 'edit',
      intent: 'edit',
      language: input.language,
      message,
      dresses: [],
      selected_dress_id: input.selectedDressId || session.selectedDressId || null,
      edited_image_url: null,
    } satisfies AgentChatResponse;
  }

  if (!hasReplicateImageModel()) {
    throw new Error('Replicate image editing is not configured locally.');
  }

  const editedImageUrl = await editImage({
    imageUrl: sourceImage,
    instruction: input.message,
    language: input.language,
  });

  const message =
    input.language === 'ar'
      ? 'تم تعديل صورة الفستان المختار مع الحفاظ على نفس الفستان الأساسي.'
      : 'I updated the selected dress image while keeping the same base dress.';

  await appendSessionMessage(session.id, {
    role: 'assistant',
    content: message,
    messageType: 'edit_result',
    dressId: input.selectedDressId || session.selectedDressId || null,
    imageUrl: sourceImage,
    editedImageUrl,
  });

  return {
    session_id: session.id,
    tool: 'edit',
    intent: 'edit',
    language: input.language,
    message,
    dresses: [],
    edited_image_url: editedImageUrl,
    selected_dress_id: input.selectedDressId || session.selectedDressId || null,
  } satisfies AgentChatResponse;
}

async function buildChatOrStylingResponse(session: AgentSessionState, input: AgentMessageRequest, intent: 'chat' | 'styling') {
  const reply = await createChatReply(session, input, intent);
  const tool = intent === 'styling' ? 'styling' : 'llm';
  const messageType = intent === 'styling' ? 'styling_response' : 'chat_response';

  await appendSessionMessage(session.id, {
    role: 'assistant',
    content: reply,
    messageType,
    dressId: input.selectedDressId || session.selectedDressId || null,
    imageUrl: input.selectedDressImageUrl || session.currentImageUrl || null,
  });

  return {
    session_id: session.id,
    tool,
    intent,
    language: input.language,
    message: reply,
    dresses: [],
    selected_dress_id: input.selectedDressId || session.selectedDressId || null,
  } satisfies AgentChatResponse;
}

async function handleLocalAgentMessage(input: AgentMessageRequest, options: { forceEdit?: boolean } = {}) {
  const session = await loadSessionState(input.sessionId);

  if (!session) {
    return {
      status: 404,
      body: { detail: 'Session not found' },
    };
  }

  const intent = options.forceEdit
    ? 'edit'
    : await detectIntent({
        message: input.message,
        language: input.language,
        hasSelectedDress: Boolean(input.selectedDressId || session.selectedDressId),
        modeHint: input.modeHint || null,
      });

  await appendSessionMessage(session.id, {
    role: 'user',
    content: input.message,
    messageType:
      intent === 'recommend'
        ? 'recommend_request'
        : intent === 'styling'
          ? 'styling_request'
          : intent === 'edit'
            ? 'edit_request'
            : 'chat_message',
    dressId: input.selectedDressId || null,
    imageUrl: input.selectedDressImageUrl || null,
    parsedData: intent === 'recommend' ? { filters: extractFilters(input.message), tokens: tokenize(input.message) } : null,
  });

  const updatedSession = (await loadSessionState(session.id)) || session;

  if (intent === 'recommend') {
    const response = await buildRecommendationResponse(updatedSession, input);
    return { status: 200, body: response };
  }

  if (intent === 'edit') {
    const response = await buildEditResponse(updatedSession, input);
    return { status: 200, body: response };
  }

  if (intent === 'styling') {
    const response = await buildChatOrStylingResponse(updatedSession, input, 'styling');
    return { status: 200, body: response };
  }

  const response = await buildChatOrStylingResponse(updatedSession, input, 'chat');
  return { status: 200, body: response };
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

function resolveLegacyBackendConfigOrNull() {
  try {
    return resolveAgentBackendConfig();
  } catch {
    return null;
  }
}

async function proxyLegacyAgent(path: string, payload: Record<string, unknown>) {
  const config = resolveLegacyBackendConfigOrNull();

  if (!config) {
    throw new Error('Legacy Glowmia agent backend is not configured.');
  }

  await ensureGlowmiaAgentBackend(config.baseUrl);
  const response = await fetchWithTimeout(
    `${config.baseUrl}${path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    getAgentProxyTimeoutMs(),
  );

  const text = await response.text();
  let data: Record<string, unknown>;

  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {
      detail: text || 'Invalid response returned by the legacy Glowmia agent backend.',
    };
  }

  return {
    status: response.status,
    body: data,
    source: 'legacy' as const,
  };
}

export async function createAgentSessionWithFallback(language: AgentLanguage) {
  try {
    const body = await createSessionState(language);
    return {
      status: 201,
      body,
      source: 'vercel' as const,
    };
  } catch (error) {
    console.error('[agent.session] Local Vercel session creation failed, attempting FastAPI fallback.', error);
    return proxyLegacyAgent('/api/v1/sessions', { language });
  }
}

export async function sendAgentMessageWithFallback(input: AgentMessageRequest, options: { forceEdit?: boolean } = {}) {
  try {
    return {
      ...(await handleLocalAgentMessage(input, options)),
      source: 'vercel' as const,
    };
  } catch (error) {
    console.error('[agent.message] Local Vercel message handling failed, attempting FastAPI fallback.', error);
    return proxyLegacyAgent('/api/v1/chat/message', {
      session_id: input.sessionId,
      message: input.message,
      language: input.language,
      selected_dress_id: input.selectedDressId || null,
      selected_dress_image_url: input.selectedDressImageUrl || null,
      mode_hint: options.forceEdit ? 'edit' : input.modeHint || null,
    });
  }
}
