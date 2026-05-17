import { getSupabaseClient, getSupabaseConfig } from '@/src/lib/supabase';
import { normalizeDressRow, type Design, type DressRow } from '@/src/data/designs';
import { fallbackDressRows } from '@/src/data/fallbackDesigns';

const BASE_DRESS_SELECT_FIELDS = [
  'id',
  'name',
  'name_ar',
  'description',
  'description_ar',
  'category',
  'occasion',
  'occasion_ar',
  'color',
  'color_ar',
  'sleeve_type',
  'sleeve_type_ar',
  'length',
  'length_ar',
  'style',
  'style_ar',
  'fabric',
  'fabric_ar',
  'fit',
  'fit_ar',
  'image_url',
  'front_view_url',
  'side_view_url',
  'back_view_url',
  'created_at',
];

const OPTIONAL_DRESS_SELECT_FIELDS = [
  'price',
  'gallery_image_urls',
  'gallery_images',
  'image_urls',
  'display_order',
  'is_featured',
  'homepage_section',
  'collection_section',
  'is_visible',
] as const;

const DEFAULT_DESIGNS_CACHE_TTL_MS = 60_000;

type DesignsCacheEntry = {
  data: Design[];
  expiresAt: number;
  pending: Promise<Design[]> | null;
};

const designsCache: DesignsCacheEntry = {
  data: [],
  expiresAt: 0,
  pending: null,
};

let dressColumnsPromise: Promise<Set<string>> | null = null;

export const PUBLIC_PAGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export function clearDesignsCache() {
  designsCache.data = [];
  designsCache.expiresAt = 0;
  designsCache.pending = null;
}

function getFallbackDesigns() {
  return fallbackDressRows.map((row, index) => normalizeDressRow(row, index));
}

async function getAvailableDressColumns(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>) {
  if (dressColumnsPromise) {
    return dressColumnsPromise;
  }

  dressColumnsPromise = (async () => {
    const found = new Set<string>();

    for (const column of OPTIONAL_DRESS_SELECT_FIELDS) {
      const { error } = await supabase.from('dresses').select(column).limit(1);

      if (!error) {
        found.add(column);
      }
    }

    return found;
  })();

  return dressColumnsPromise;
}

function compareDesignRows(left: DressRow, right: DressRow) {
  const leftDisplayOrder = Number.isFinite(Number(left.display_order)) ? Number(left.display_order) : 0;
  const rightDisplayOrder = Number.isFinite(Number(right.display_order)) ? Number(right.display_order) : 0;

  if (leftDisplayOrder !== rightDisplayOrder) {
    return leftDisplayOrder - rightDisplayOrder;
  }

  const leftCreatedAt = left.created_at ? new Date(left.created_at).getTime() : 0;
  const rightCreatedAt = right.created_at ? new Date(right.created_at).getTime() : 0;
  return rightCreatedAt - leftCreatedAt;
}

async function loadDesignsFromSource(options: { includeHidden?: boolean } = {}) {
  const supabase = getSupabaseClient();
  const { url, publishableKey } = getSupabaseConfig();

  if (!supabase || !url || !publishableKey) {
    return getFallbackDesigns();
  }

  const availableColumns = await getAvailableDressColumns(supabase);
  const selectFields = [...BASE_DRESS_SELECT_FIELDS, ...OPTIONAL_DRESS_SELECT_FIELDS.filter((column) => availableColumns.has(column))].join(', ');
  const { data, error } = await supabase.from('dresses').select(selectFields);

  if (error) {
    console.error('Failed to load dresses from Supabase:', error.message);
    return getFallbackDesigns();
  }

  const rows = (data ?? []) as DressRow[];

  if (rows.length === 0) {
    return getFallbackDesigns();
  }

  const visibleRows = options.includeHidden ? rows : rows.filter((row) => row.is_visible !== false);
  const sortedRows = [...visibleRows].sort(compareDesignRows);
  return sortedRows.map((row, index) => normalizeDressRow(row, index));
}

export async function getAllDesignsFromSupabase(options?: { forceRefresh?: boolean; ttlMs?: number; includeHidden?: boolean }): Promise<Design[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_DESIGNS_CACHE_TTL_MS;
  const now = Date.now();
  const cacheEnabled = !options?.includeHidden;

  if (cacheEnabled && !options?.forceRefresh && designsCache.data.length > 0 && now < designsCache.expiresAt) {
    return designsCache.data;
  }

  if (cacheEnabled && !options?.forceRefresh && designsCache.pending) {
    return designsCache.pending;
  }

  const pending = loadDesignsFromSource({ includeHidden: options?.includeHidden })
    .then((designs) => {
      if (cacheEnabled) {
        designsCache.data = designs;
        designsCache.expiresAt = Date.now() + ttlMs;
      }
      return designs;
    })
    .catch((error) => {
      if (cacheEnabled && designsCache.data.length > 0) {
        return designsCache.data;
      }

      throw error;
    })
    .finally(() => {
      if (cacheEnabled) {
        designsCache.pending = null;
      }
    });

  if (cacheEnabled) {
    designsCache.pending = pending;
  }

  return pending;
}
