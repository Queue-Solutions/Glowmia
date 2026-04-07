import { getSupabaseClient, getSupabaseConfig } from '@/src/lib/supabase';
import { normalizeDressRow, type Design, type DressRow } from '@/src/data/designs';

const DRESS_SELECT_FIELDS = [
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
  'cover_image_url',
  'image_url',
  'created_at',
].join(', ');

export async function getAllDesignsFromSupabase(): Promise<Design[]> {
  const supabase = getSupabaseClient();
  const { url, publishableKey } = getSupabaseConfig();

  if (!supabase || !url || !publishableKey) {
    return [];
  }

  const { data, error } = await supabase
    .from('dresses')
    .select(DRESS_SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load dresses from Supabase:', error.message);
    return [];
  }

  const rows = (data ?? []) as DressRow[];

  return rows.map((row, index) => normalizeDressRow(row, index));
}
