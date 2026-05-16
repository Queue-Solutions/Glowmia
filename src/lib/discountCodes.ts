import { getSupabaseAdminClient } from '@/src/lib/adminSupabase';

export type DiscountCodeRecord = {
  id: string;
  code: string;
  percentage: number;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
};

type AdminDiscountCodeInput = {
  code: string;
  percentage: number;
  isActive: boolean;
  usageLimit?: number | null;
  expiresAt?: string | null;
};

const COUPONS_TABLE = 'coupons';
const COUPON_FIELDS = [
  'id',
  'code',
  'discount_percentage',
  'is_active',
  'usage_limit',
  'used_count',
  'expires_at',
  'created_at',
];

const columnCache = new Map<string, Promise<Set<string>>>();

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizePercentage(value: unknown) {
  const percentage = Math.round(Number(value));
  return Number.isFinite(percentage) ? percentage : NaN;
}

function normalizeUsageLimit(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const usageLimit = Math.max(0, Math.round(Number(value)));
  return Number.isFinite(usageLimit) ? usageLimit : NaN;
}

function normalizeExpiryDate(value: unknown) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'invalid' : date.toISOString();
}

function getSupabase() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabase;
}

function getTable(table: string) {
  const supabase = getSupabase();
  return (supabase.from as (tableName: string) => any)(table);
}

async function getAvailableColumns(table: string, candidates: readonly string[]) {
  const cacheKey = `${table}:${candidates.join(',')}`;
  const cached = columnCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const found = new Set<string>();

    for (const column of candidates) {
      try {
        const { error } = await getTable(table).select(column).limit(1);

        if (!error) {
          found.add(column);
        }
      } catch (e) {
        console.warn(`[discountCodes] Failed to check column ${column}:`, e);
      }
    }

    // If no columns were found, return all candidates (they might exist but fail due to RLS)
    if (found.size === 0) {
      console.warn(`[discountCodes] No columns detected for table ${table}, assuming all columns exist`);
      candidates.forEach((col) => found.add(col));
    }

    return found;
  })();

  columnCache.set(cacheKey, pending);
  return pending;
}

function buildSelect(columns: Set<string>, candidates: readonly string[]) {
  const selected = candidates.filter((column) => columns.has(column)).join(', ');

  if (!selected) {
    console.warn('[discountCodes.buildSelect] Empty select clause, falling back to all candidates');
    return candidates.join(', ');
  }

  return selected;
}

function readCouponRow(row: Record<string, unknown>): DiscountCodeRecord {
  return {
    id: normalizeString(row.id),
    code: normalizeCode(normalizeString(row.code)),
    percentage: Math.max(0, Number(row.discount_percentage) || 0),
    isActive: row.is_active !== false,
    usageLimit: row.usage_limit === null || row.usage_limit === undefined ? null : Math.max(0, Number(row.usage_limit) || 0),
    usedCount: Math.max(0, Number(row.used_count) || 0),
    expiresAt: normalizeOptionalString(row.expires_at),
    createdAt: normalizeString(row.created_at),
  };
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() < Date.now();
}

function hasReachedUsageLimit(coupon: DiscountCodeRecord) {
  return typeof coupon.usageLimit === 'number' && coupon.usageLimit >= 0 && coupon.usedCount >= coupon.usageLimit;
}

async function findCouponByCode(code: string, columns?: Set<string>) {
  const availableColumns = columns ?? (await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS));
  const select = buildSelect(availableColumns, COUPON_FIELDS);
  const { data, error } = await getTable(COUPONS_TABLE).select(select).eq('code', normalizeCode(code)).limit(1);

  if (error) {
    throw new Error(error.message || 'Unable to load the coupon.');
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return rows[0] ? readCouponRow(rows[0]) : null;
}

async function findCouponById(id: string, columns?: Set<string>) {
  const availableColumns = columns ?? (await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS));
  const select = buildSelect(availableColumns, COUPON_FIELDS);
  const { data, error } = await getTable(COUPONS_TABLE).select(select).eq('id', id).limit(1);

  if (error) {
    throw new Error(error.message || 'Unable to load the coupon.');
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return rows[0] ? readCouponRow(rows[0]) : null;
}

function validateCouponInput(input: AdminDiscountCodeInput) {
  const code = normalizeCode(input.code);
  const percentage = normalizePercentage(input.percentage);
  const usageLimit = normalizeUsageLimit(input.usageLimit);
  const expiresAt = normalizeExpiryDate(input.expiresAt);

  if (!code) {
    throw new Error('Coupon code is required.');
  }

  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    throw new Error('Discount percentage must be greater than 0 and less than or equal to 100.');
  }

  if (Number.isNaN(usageLimit)) {
    throw new Error('Usage limit must be a whole number.');
  }

  if (expiresAt === 'invalid') {
    throw new Error('Expiry date must be a valid date.');
  }

  return {
    code,
    percentage,
    isActive: input.isActive !== false,
    usageLimit,
    expiresAt,
  };
}

export async function listDiscountCodes() {
  const columns = await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS);
  const select = buildSelect(columns, COUPON_FIELDS);
  let query = getTable(COUPONS_TABLE).select(select);

  if (columns.has('created_at')) {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Unable to load coupons.');
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map(readCouponRow);
}

export async function createDiscountCode(input: AdminDiscountCodeInput) {
  const validated = validateCouponInput(input);
  console.info('[discountCodes.createDiscountCode] Validated input', { validated });

  const columns = await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS);
  console.info('[discountCodes.createDiscountCode] Available columns', {
    availableColumns: Array.from(columns),
    expectedFields: COUPON_FIELDS,
  });

  const existing = await findCouponByCode(validated.code, columns);

  if (existing) {
    throw new Error('A coupon with this code already exists.');
  }

  const payload: Record<string, unknown> = {};

  if (columns.has('code')) {
    payload.code = validated.code;
  }

  if (columns.has('discount_percentage')) {
    payload.discount_percentage = validated.percentage;
  }

  if (columns.has('is_active')) {
    payload.is_active = validated.isActive;
  }

  if (columns.has('usage_limit')) {
    payload.usage_limit = validated.usageLimit;
  }

  if (columns.has('expires_at')) {
    payload.expires_at = validated.expiresAt;
  }

  if (columns.has('used_count')) {
    payload.used_count = 0;
  }

  console.info('[discountCodes.createDiscountCode] Insert payload', { payload });

  const select = buildSelect(columns, COUPON_FIELDS);
  console.info('[discountCodes.createDiscountCode] Select clause', { select });

  const { data, error } = await getTable(COUPONS_TABLE).insert(payload).select(select).single();

  if (error) {
    console.error('[discountCodes.createDiscountCode] Supabase insert error', {
      error: error.message,
      details: (error as any).details,
      code: (error as any).code,
    });
    throw new Error(error.message || 'Unable to create the coupon.');
  }

  console.info('[discountCodes.createDiscountCode] Coupon inserted', {
    id: (data as any)?.id,
    code: (data as any)?.code,
  });

  return readCouponRow((data ?? {}) as Record<string, unknown>);
}

export async function updateDiscountCode(input: { id: string } & AdminDiscountCodeInput) {
  const validated = validateCouponInput(input);
  const columns = await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS);
  const existing = await findCouponById(normalizeString(input.id), columns);

  if (!existing) {
    throw new Error('Coupon not found.');
  }

  const duplicate = await findCouponByCode(validated.code, columns);

  if (duplicate && duplicate.id !== existing.id) {
    throw new Error('A coupon with this code already exists.');
  }

  const payload: Record<string, unknown> = {};

  if (columns.has('code')) {
    payload.code = validated.code;
  }

  if (columns.has('discount_percentage')) {
    payload.discount_percentage = validated.percentage;
  }

  if (columns.has('is_active')) {
    payload.is_active = validated.isActive;
  }

  if (columns.has('usage_limit')) {
    payload.usage_limit = validated.usageLimit;
  }

  if (columns.has('expires_at')) {
    payload.expires_at = validated.expiresAt;
  }

  const select = buildSelect(columns, COUPON_FIELDS);
  const { data, error } = await getTable(COUPONS_TABLE).update(payload).eq('id', existing.id).select(select).single();

  if (error) {
    throw new Error(error.message || 'Unable to update the coupon.');
  }

  return readCouponRow((data ?? {}) as Record<string, unknown>);
}

export async function validateDiscountCode(code: string) {
  const coupon = await findCouponByCode(code);

  if (!coupon) {
    return null;
  }

  if (!coupon.isActive || isExpired(coupon.expiresAt) || hasReachedUsageLimit(coupon)) {
    return null;
  }

  return coupon;
}

export async function redeemDiscountCode(input: { code: string; orderId: string; customerName: string }) {
  const columns = await getAvailableColumns(COUPONS_TABLE, COUPON_FIELDS);
  const coupon = await findCouponByCode(input.code, columns);

  if (!coupon || !coupon.isActive || isExpired(coupon.expiresAt) || hasReachedUsageLimit(coupon)) {
    return null;
  }

  const nextUsedCount = coupon.usedCount + 1;
  const payload: Record<string, unknown> = {};

  if (columns.has('used_count')) {
    payload.used_count = nextUsedCount;
  }

  const select = buildSelect(columns, COUPON_FIELDS);
  const { data, error } = await getTable(COUPONS_TABLE).update(payload).eq('id', coupon.id).select(select).single();

  if (error) {
    throw new Error(error.message || 'Unable to update the coupon usage count.');
  }

  return readCouponRow((data ?? {}) as Record<string, unknown>);
}
