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

const DRESS_SELECT_FIELDS = [
  ...BASE_DRESS_SELECT_FIELDS,
  'gallery_image_urls',
  'gallery_images',
  'image_urls',
].join(', ');

const FALLBACK_DRESS_SELECT_FIELDS = BASE_DRESS_SELECT_FIELDS.join(', ');

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

export const PUBLIC_PAGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

function getFallbackDesigns() {
  return fallbackDressRows.map((row, index) => normalizeDressRow(row, index));
}

async function loadDesignsFromSource() {
  const supabase = getSupabaseClient();
  const { url, publishableKey } = getSupabaseConfig();

  if (!supabase || !url || !publishableKey) {
    return getFallbackDesigns();
  }

  let { data, error } = await supabase
    .from('dresses')
    .select(DRESS_SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (error) {
    const missingGalleryColumn = /gallery_image_urls|gallery_images|image_urls/i.test(error.message);

    if (missingGalleryColumn) {
      const fallbackResponse = await supabase
        .from('dresses')
        .select(FALLBACK_DRESS_SELECT_FIELDS)
        .order('created_at', { ascending: false });

      data = fallbackResponse.data;
      error = fallbackResponse.error;
    }

    if (error) {
      console.error('Failed to load dresses from Supabase:', error.message);
      return getFallbackDesigns();
    }
  }

  const rows = (data ?? []) as DressRow[];

  if (rows.length === 0) {
    return getFallbackDesigns();
  }

  return rows.map((row, index) => normalizeDressRow(row, index));
}

export async function getAllDesignsFromSupabase(options?: { forceRefresh?: boolean; ttlMs?: number }): Promise<Design[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_DESIGNS_CACHE_TTL_MS;
  const now = Date.now();

  if (!options?.forceRefresh && designsCache.data.length > 0 && now < designsCache.expiresAt) {
    return designsCache.data;
  }

  if (!options?.forceRefresh && designsCache.pending) {
    return designsCache.pending;
  }

  designsCache.pending = loadDesignsFromSource()
    .then((designs) => {
      designsCache.data = designs;
      designsCache.expiresAt = Date.now() + ttlMs;
      return designs;
    })
    .catch((error) => {
      if (designsCache.data.length > 0) {
        return designsCache.data;
      }

      throw error;
    })
    .finally(() => {
      designsCache.pending = null;
    });

  return designsCache.pending;
}
