import type { NextApiRequest } from 'next';
import { DRESS_IMAGES_BUCKET } from '@/src/lib/adminSupabase';

export type AdminDressPayload = {
  name: string;
  nameAr: string | null;
  description: string;
  descriptionAr: string | null;
  category: string;
  occasion: string[];
  occasionAr: string[];
  color: string;
  colorAr: string | null;
  sleeveType: string;
  sleeveTypeAr: string | null;
  length: string;
  lengthAr: string | null;
  style: string[];
  styleAr: string[];
  fabric: string;
  fabricAr: string | null;
  fit: string;
  fitAr: string | null;
  coverImageUrl: string;
  imageUrl: string;
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalText(value: unknown) {
  const normalized = asText(value);
  return normalized || null;
}

function asTagList(value: unknown) {
  const source = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(new Set(source.map((entry) => entry.trim()).filter(Boolean)));
}

export function validateAdminDressPayload(body: NextApiRequest['body']): { payload: AdminDressPayload | null; error: string | null } {
  const payload: AdminDressPayload = {
    name: asText(body?.name),
    nameAr: asOptionalText(body?.nameAr),
    description: asText(body?.description),
    descriptionAr: asOptionalText(body?.descriptionAr),
    category: asText(body?.category).toLowerCase() || 'other',
    occasion: asTagList(body?.occasion),
    occasionAr: asTagList(body?.occasionAr),
    color: asText(body?.color),
    colorAr: asOptionalText(body?.colorAr),
    sleeveType: asText(body?.sleeveType),
    sleeveTypeAr: asOptionalText(body?.sleeveTypeAr),
    length: asText(body?.length),
    lengthAr: asOptionalText(body?.lengthAr),
    style: asTagList(body?.style),
    styleAr: asTagList(body?.styleAr),
    fabric: asText(body?.fabric),
    fabricAr: asOptionalText(body?.fabricAr),
    fit: asText(body?.fit),
    fitAr: asOptionalText(body?.fitAr),
    coverImageUrl: asText(body?.coverImageUrl),
    imageUrl: asText(body?.imageUrl),
  };

  if (!payload.name || !payload.description) {
    return { payload: null, error: 'Name and description are required.' };
  }

  if (!payload.coverImageUrl || !payload.imageUrl) {
    return { payload: null, error: 'Cover image URL and full image URL are required.' };
  }

  if (!payload.color || !payload.sleeveType || !payload.length || !payload.fabric || !payload.fit) {
    return { payload: null, error: 'Color, sleeve type, length, fabric, and fit are required.' };
  }

  if (payload.occasion.length === 0) {
    return { payload: null, error: 'Add at least one occasion tag.' };
  }

  if (payload.style.length === 0) {
    return { payload: null, error: 'Add at least one style tag.' };
  }

  return { payload, error: null };
}

export function toDressInsertPayload(payload: AdminDressPayload) {
  return {
    name: payload.name,
    name_ar: payload.nameAr,
    description: payload.description,
    description_ar: payload.descriptionAr,
    category: payload.category,
    occasion: payload.occasion,
    occasion_ar: payload.occasionAr.length > 0 ? payload.occasionAr : null,
    color: payload.color,
    color_ar: payload.colorAr,
    sleeve_type: payload.sleeveType,
    sleeve_type_ar: payload.sleeveTypeAr,
    length: payload.length,
    length_ar: payload.lengthAr,
    style: payload.style,
    style_ar: payload.styleAr.length > 0 ? payload.styleAr : null,
    fabric: payload.fabric,
    fabric_ar: payload.fabricAr,
    fit: payload.fit,
    fit_ar: payload.fitAr,
    cover_image_url: payload.coverImageUrl,
    image_url: payload.imageUrl,
  };
}

export function extractStoragePathFromUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${DRESS_IMAGES_BUCKET}/`;
    const index = url.pathname.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export function getManagedUploadPath(value: unknown) {
  const storagePath = extractStoragePathFromUrl(value);
  return storagePath?.startsWith('admin-uploads/') ? storagePath : null;
}
