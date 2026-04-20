import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SavedDesignRecord = {
  id: string;
  userId: string | null;
  guestId: string | null;
  dressId: string;
  orderId: string | null;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt: string;
  designName: string;
  notes: string;
  isOrdered: boolean;
  createdAt: string;
};

export type CheckoutOrderRecord = {
  id: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  items: Array<{
    designId: string;
    designName: string;
    size: string | null;
    quantity: number;
    imageUrl: string;
    frontViewUrl: string;
    sideViewUrl: string;
    backViewUrl: string;
    color: string | null;
    savedDesignId?: string | null;
    originalImageUrl?: string | null;
    editedImageUrl?: string | null;
  }>;
  notes: string;
  status: string;
  createdAt: string;
};

export type AdminSavedDesignEntry = {
  id: string;
  sessionId: string | null;
  language: 'en' | 'ar';
  customerName: string;
  customerPhone: string;
  dressId: string;
  dressName: string;
  originalImageUrl: string;
  editedImageUrl: string;
  createdAt: string;
};

type SaveDesignInput = {
  userId: string | null;
  guestId: string | null;
  dressId: string;
  originalImageUrl: string;
  editedImageUrl: string;
  prompt?: string | null;
  designName?: string | null;
  notes?: string | Record<string, unknown> | null;
  orderId?: string | null;
  isOrdered?: boolean;
};

type CreateOrderRowsInput = {
  customer: CheckoutOrderRecord['customer'];
  items: CheckoutOrderRecord['items'];
  notes: string;
  status?: string;
  userId?: string | null;
  guestId?: string | null;
};

const SAVED_DESIGNS_TABLE = 'glowmia_saved_designs';
const ORDERS_TABLE = 'glowmia_orders';

const SAVED_DESIGN_FIELDS = [
  'id',
  'user_id',
  'guest_id',
  'dress_id',
  'order_id',
  'original_image_url',
  'edited_image_url',
  'prompt',
  'design_name',
  'notes',
  'is_ordered',
  'created_at',
] as const;

const ORDER_FIELDS = [
  'id',
  'user_id',
  'guest_id',
  'dress_id',
  'dress_name',
  'front_view_url',
  'side_view_url',
  'back_view_url',
  'edited_image_url',
  'customer_name',
  'phone',
  'address',
  'city',
  'size',
  'color',
  'notes',
  'status',
  'created_at',
] as const;

let supabaseClient: SupabaseClient | null | undefined;
const tableColumnCache = new Map<string, Promise<Set<string>>>();

type SupabaseLikeError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function getSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ''
  );
}

function getServerSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const key = getSupabaseKey();

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function isMissingTableError(message: string) {
  return /Could not find the table/i.test(message);
}

function toJsonString(value: string | Record<string, unknown> | null | undefined) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function parseJsonRecord(value: unknown) {
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

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalString(value: unknown) {
  const normalized = readString(value);
  return normalized || null;
}

function readBoolean(value: unknown) {
  return value === true;
}

function describeSupabaseError(error: SupabaseLikeError, context: string) {
  const details = [error.message.trim()];

  if (error.code) {
    details.push(`code=${error.code}`);
  }

  if (error.details) {
    details.push(`details=${error.details}`);
  }

  if (error.hint) {
    details.push(`hint=${error.hint}`);
  }

  return `[${context}] ${details.join(' | ')}`;
}

function toErrorWithContext(error: SupabaseLikeError, context: string) {
  if (error.code === '42501' && !hasServiceRoleKey()) {
    return new Error(
      `${describeSupabaseError(error, context)}. The "${SAVED_DESIGNS_TABLE}" table is protected by RLS, and this route currently has no SUPABASE_SERVICE_ROLE_KEY configured.`,
    );
  }

  return new Error(describeSupabaseError(error, context));
}

async function getAvailableColumns(table: string, candidates: readonly string[]) {
  const cacheKey = `${table}:${candidates.join(',')}`;
  const cached = tableColumnCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const supabase = getServerSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const found = new Set<string>();

    for (const column of candidates) {
      const { error } = await supabase.from(table).select(column).limit(1);

      if (!error) {
        found.add(column);
        continue;
      }

      if (isMissingTableError(error.message)) {
        throw new Error(`Supabase table "${table}" is not available in the public schema.`);
      }
    }

    return found;
  })();

  tableColumnCache.set(cacheKey, pending);
  return pending;
}

function buildSelect(columns: Set<string>, candidates: readonly string[]) {
  return candidates.filter((column) => columns.has(column)).join(', ');
}

function readSavedDesign(row: Record<string, unknown>): SavedDesignRecord {
  return {
    id: readString(row.id),
    userId: readOptionalString(row.user_id),
    guestId: readOptionalString(row.guest_id),
    dressId: readString(row.dress_id),
    orderId: readOptionalString(row.order_id),
    originalImageUrl: readString(row.original_image_url),
    editedImageUrl: readString(row.edited_image_url),
    prompt: readString(row.prompt),
    designName: readString(row.design_name),
    notes: readString(row.notes),
    isOrdered: readBoolean(row.is_ordered),
    createdAt: readString(row.created_at),
  };
}

function readCheckoutOrder(row: Record<string, unknown>) {
  const imageUrl = readString(row.edited_image_url) || readString(row.front_view_url);

  return {
    id: readString(row.id),
    customer: {
      name: readString(row.customer_name),
      phone: readString(row.phone),
      address: readString(row.address),
      city: readString(row.city),
    },
    items: [
      {
        designId: readString(row.dress_id),
        designName: readString(row.dress_name),
        size: readOptionalString(row.size),
        quantity: 1,
        imageUrl,
        frontViewUrl: readString(row.front_view_url) || imageUrl,
        sideViewUrl: readString(row.side_view_url) || readString(row.front_view_url) || imageUrl,
        backViewUrl: readString(row.back_view_url) || readString(row.side_view_url) || readString(row.front_view_url) || imageUrl,
        color: readOptionalString(row.color),
      },
    ],
    notes: readString(row.notes),
    status: readString(row.status) || 'pending',
    createdAt: readString(row.created_at),
  } satisfies CheckoutOrderRecord;
}

export async function saveAgentDesign(input: SaveDesignInput) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(SAVED_DESIGNS_TABLE, SAVED_DESIGN_FIELDS);
  const payload: Record<string, unknown> = {};

  if (columns.has('user_id') && input.userId) {
    payload.user_id = input.userId;
  }

  if (columns.has('guest_id')) {
    payload.guest_id = input.guestId || null;
  }

  if (columns.has('dress_id')) {
    payload.dress_id = input.dressId;
  }

  if (columns.has('order_id') && input.orderId) {
    payload.order_id = input.orderId;
  }

  if (columns.has('original_image_url')) {
    payload.original_image_url = input.originalImageUrl;
  }

  if (columns.has('edited_image_url')) {
    payload.edited_image_url = input.editedImageUrl;
  }

  if (columns.has('prompt')) {
    payload.prompt = input.prompt?.trim() || null;
  }

  if (columns.has('design_name')) {
    payload.design_name = input.designName?.trim() || null;
  }

  if (columns.has('notes')) {
    payload.notes = toJsonString(input.notes);
  }

  if (columns.has('is_ordered')) {
    payload.is_ordered = Boolean(input.isOrdered);
  }

  const select = buildSelect(columns, SAVED_DESIGN_FIELDS);
  const { data, error } = await supabase.from(SAVED_DESIGNS_TABLE).insert(payload).select(select).single();

  if (error) {
    throw toErrorWithContext(error, 'saveAgentDesign.insert');
  }

  return readSavedDesign((data ?? {}) as unknown as Record<string, unknown>);
}

export async function getSavedDesignById(savedDesignId: string) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(SAVED_DESIGNS_TABLE, SAVED_DESIGN_FIELDS);
  const select = buildSelect(columns, SAVED_DESIGN_FIELDS);
  const { data, error } = await supabase.from(SAVED_DESIGNS_TABLE).select(select).eq('id', savedDesignId).maybeSingle();

  if (error) {
    throw toErrorWithContext(error, 'getSavedDesignById.select');
  }

  if (!data) {
    return null;
  }

  return readSavedDesign(data as unknown as Record<string, unknown>);
}

export async function markSavedDesignOrdered(savedDesignId: string, orderId: string) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(SAVED_DESIGNS_TABLE, SAVED_DESIGN_FIELDS);
  const payload: Record<string, unknown> = {};

  if (columns.has('order_id')) {
    payload.order_id = orderId;
  }

  if (columns.has('is_ordered')) {
    payload.is_ordered = true;
  }

  if (Object.keys(payload).length === 0) {
    return getSavedDesignById(savedDesignId);
  }

  const select = buildSelect(columns, SAVED_DESIGN_FIELDS);
  const { data, error } = await supabase.from(SAVED_DESIGNS_TABLE).update(payload).eq('id', savedDesignId).select(select).maybeSingle();

  if (error) {
    throw toErrorWithContext(error, 'markSavedDesignOrdered.update');
  }

  return data ? readSavedDesign(data as unknown as Record<string, unknown>) : null;
}

export async function createCheckoutOrders(input: CreateOrderRowsInput) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(ORDERS_TABLE, ORDER_FIELDS);
  const payload = input.items.map((item) => {
    const row: Record<string, unknown> = {};

    if (columns.has('user_id') && input.userId) {
      row.user_id = input.userId;
    }

    if (columns.has('guest_id')) {
      row.guest_id = input.guestId || null;
    }

    if (columns.has('dress_id')) {
      row.dress_id = item.designId;
    }

    if (columns.has('dress_name')) {
      row.dress_name = item.designName;
    }

    if (columns.has('front_view_url')) {
      row.front_view_url = item.frontViewUrl || item.imageUrl;
    }

    if (columns.has('side_view_url')) {
      row.side_view_url = item.sideViewUrl || item.frontViewUrl || item.imageUrl;
    }

    if (columns.has('back_view_url')) {
      row.back_view_url = item.backViewUrl || item.sideViewUrl || item.frontViewUrl || item.imageUrl;
    }

    if (columns.has('edited_image_url') && item.editedImageUrl) {
      row.edited_image_url = item.editedImageUrl;
    }

    if (columns.has('customer_name')) {
      row.customer_name = input.customer.name;
    }

    if (columns.has('phone')) {
      row.phone = input.customer.phone;
    }

    if (columns.has('address')) {
      row.address = input.customer.address;
    }

    if (columns.has('city')) {
      row.city = input.customer.city;
    }

    if (columns.has('size')) {
      row.size = item.size || '';
    }

    if (columns.has('color')) {
      row.color = item.color || '';
    }

    if (columns.has('notes')) {
      row.notes = input.notes || '';
    }

    if (columns.has('status')) {
      row.status = input.status?.trim() || 'pending';
    }

    return row;
  });

  const select = buildSelect(columns, ORDER_FIELDS);
  const { data, error } = await supabase.from(ORDERS_TABLE).insert(payload).select(select);

  if (error) {
    throw toErrorWithContext(error, 'createCheckoutOrders.insert');
  }

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(readCheckoutOrder);
}

export async function listCheckoutOrdersFromSupabase() {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(ORDERS_TABLE, ORDER_FIELDS);
  const select = buildSelect(columns, ORDER_FIELDS);
  let query = supabase.from(ORDERS_TABLE).select(select);

  if (columns.has('created_at')) {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw toErrorWithContext(error, 'listCheckoutOrdersFromSupabase.select');
  }

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(readCheckoutOrder);
}

export async function listSavedDesignsForAdmin() {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const columns = await getAvailableColumns(SAVED_DESIGNS_TABLE, SAVED_DESIGN_FIELDS);
  const select = buildSelect(columns, SAVED_DESIGN_FIELDS);
  const { data, error } = await supabase.from(SAVED_DESIGNS_TABLE).select(select).order('created_at', { ascending: false });

  if (error) {
    throw toErrorWithContext(error, 'listSavedDesignsForAdmin.select');
  }

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
    const savedDesign = readSavedDesign(row);
    const notes = parseJsonRecord(savedDesign.notes);

    return {
      id: savedDesign.id,
      sessionId: readOptionalString(notes?.sessionId),
      language: readString(notes?.language) === 'ar' ? 'ar' : 'en',
      customerName: readString(notes?.customerName),
      customerPhone: readString(notes?.customerPhone),
      dressId: savedDesign.dressId,
      dressName: savedDesign.designName || savedDesign.dressId,
      originalImageUrl: savedDesign.originalImageUrl,
      editedImageUrl: savedDesign.editedImageUrl || savedDesign.originalImageUrl,
      createdAt: savedDesign.createdAt,
    } satisfies AdminSavedDesignEntry;
  });
}
