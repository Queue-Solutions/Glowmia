import type { Language } from '@/src/content/glowmia';

export type LocalizedText = {
  en: string;
  ar: string;
};

export type DesignCategory = 'evening' | 'casual' | 'formal' | 'other';

export type Design = {
  id: string;
  slug: string;
  name: LocalizedText;
  subtitle: LocalizedText;
  description: LocalizedText;
  story: LocalizedText;
  category: DesignCategory;
  categoryLabel: LocalizedText;
  occasion: LocalizedText;
  color: LocalizedText;
  sleeveType: LocalizedText;
  length: LocalizedText;
  style: LocalizedText;
  fabric: LocalizedText;
  fit: LocalizedText;
  coverImage: string;
  coverImagePosition?: string;
  detailImage?: string;
  galleryImages: string[];
  isFeatured: boolean;
  isNew: boolean;
};

export type DressRow = {
  id?: string | number | null;
  name?: string | null;
  name_ar?: string | null;
  description?: string | null;
  description_ar?: string | null;
  category?: string | null;
  category_ar?: string | null;
  occasion?: string | string[] | null;
  occasion_ar?: string | string[] | null;
  color?: string | null;
  color_ar?: string | null;
  sleeve_type?: string | null;
  sleeve_type_ar?: string | null;
  length?: string | null;
  length_ar?: string | null;
  style?: string | string[] | null;
  style_ar?: string | string[] | null;
  fabric?: string | null;
  fabric_ar?: string | null;
  fit?: string | null;
  fit_ar?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  created_at?: string | null;
  is_featured?: boolean | null;
  gallery_image_urls?: string[] | null;
  gallery_images?: string[] | null;
  image_urls?: string[] | null;
};

export const designCategories: DesignCategory[] = ['evening', 'casual', 'formal', 'other'];

const FALLBACK_IMAGE = '/glowmia-logo.svg';

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeTextValue(value: unknown, fallback = '') {
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((entry) => typeof entry === 'string' && entry.trim())
      .map((entry) => String(entry).trim());

    if (cleaned.length > 0) {
      return cleaned.join(', ');
    }
  }

  return cleanText(value, fallback);
}

function humanizeValue(value: string) {
  return titleCase(value).replace(/\s+/g, ' ').trim();
}

function toBilingualText(primary: unknown, secondary: unknown, fallback = ''): LocalizedText {
  return {
    en: normalizeTextValue(primary, fallback),
    ar: normalizeTextValue(secondary, normalizeTextValue(primary, fallback)),
  };
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-');
}

function normalizeCategory(value: unknown, occasion?: unknown, style?: unknown): DesignCategory {
  const safeValue = [
    normalizeTextValue(value).toLowerCase(),
    normalizeTextValue(occasion).toLowerCase(),
    normalizeTextValue(style).toLowerCase(),
  ].join(' ');

  if (safeValue.includes('evening')) {
    return 'evening';
  }

  if (safeValue.includes('formal')) {
    return 'formal';
  }

  if (safeValue.includes('casual') || safeValue.includes('day') || safeValue.includes('daily')) {
    return 'casual';
  }

  return 'other';
}

function normalizeGalleryImages(row: DressRow, coverImage: string) {
  const values = [row.gallery_image_urls, row.gallery_images, row.image_urls]
    .find((entry) => Array.isArray(entry)) as string[] | undefined;

  const cleaned = (values ?? [])
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim());

  if (cleaned.length > 0) {
    return cleaned;
  }

  return coverImage ? [coverImage] : [FALLBACK_IMAGE];
}

function extractDressAssetNumber(value: string) {
  const match = value.match(/Dress%20(\d+)|Dress (\d+)/i);
  const normalized = match?.[1] ?? match?.[2];
  return normalized ? Number(normalized) : null;
}

function buildFullImageFromCover(coverImage: string) {
  const dressNumber = extractDressAssetNumber(coverImage);

  if (!dressNumber) {
    return '';
  }

  try {
    const url = new URL(coverImage);
    return `${url.origin}/storage/v1/object/public/dress-images/Dress%20${dressNumber}.jpeg`;
  } catch {
    return '';
  }
}

function resolveDetailImage(row: DressRow, coverImage: string, fallbackImage: string) {
  const coverNumber = extractDressAssetNumber(coverImage);
  const imageUrl = cleanText(row.image_url, '');
  const imageNumber = extractDressAssetNumber(imageUrl);

  if (coverNumber && imageNumber && coverNumber === imageNumber) {
    return imageUrl;
  }

  const inferredFullImage = buildFullImageFromCover(coverImage);

  if (inferredFullImage) {
    return inferredFullImage;
  }

  return cleanText(imageUrl, fallbackImage);
}

function buildDescriptionFallback(row: DressRow) {
  const color = normalizeTextValue(row.color);
  const sleeve = normalizeTextValue(row.sleeve_type);
  const length = normalizeTextValue(row.length);
  const style = normalizeTextValue(row.style);
  const fabric = normalizeTextValue(row.fabric);
  const occasion = normalizeTextValue(row.occasion);

  const details = [color, sleeve, length, style, fabric]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  const lead = details.length > 0 ? details.join(', ') : 'refined';
  const ending = occasion ? ` suited for ${occasion.toLowerCase()}.` : '.';

  return `A ${lead} Glowmia dress designed with a polished silhouette and elegant presence${ending}`;
}

function buildArabicDescriptionFallback(row: DressRow) {
  const color = normalizeTextValue(row.color_ar);
  const sleeve = normalizeTextValue(row.sleeve_type_ar);
  const length = normalizeTextValue(row.length_ar);
  const style = normalizeTextValue(row.style_ar);
  const fabric = normalizeTextValue(row.fabric_ar);
  const occasion = normalizeTextValue(row.occasion_ar);

  const details = [color, sleeve, length, style, fabric].filter(Boolean).join('، ');
  const lead = details || 'فستان راقٍ';
  const ending = occasion ? ` مناسب لـ ${occasion}.` : '.';

  return `${lead} من Glowmia بقصة أنيقة وحضور ناعم${ending}`;
}

function buildSubtitleValue(row: DressRow, language: 'en' | 'ar') {
  const values =
    language === 'ar'
      ? [normalizeTextValue(row.occasion_ar), normalizeTextValue(row.style_ar), normalizeTextValue(row.category_ar)]
      : [normalizeTextValue(row.occasion), normalizeTextValue(row.style), normalizeTextValue(row.category)];

  return values.find(Boolean) || (language === 'ar' ? 'تصميم من البورتفوليو' : 'Portfolio design');
}

function buildCategoryLabel(row: DressRow) {
  const english = normalizeTextValue(row.category);
  const arabic = normalizeTextValue(row.category_ar);

  return {
    en: english ? humanizeValue(english) : 'Dress',
    ar: arabic || 'فستان',
  };
}

function isRecentDress(createdAt: string | null | undefined, index: number) {
  if (!createdAt) {
    return index < 4;
  }

  const createdTime = new Date(createdAt).getTime();

  if (Number.isNaN(createdTime)) {
    return index < 4;
  }

  const daysOld = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);

  return daysOld <= 45;
}

export function buildDesignSlug(id: string, name: string) {
  const base = slugify(name || 'design');
  return `${base || 'design'}--${id}`;
}

export function normalizeDressRow(row: DressRow, index: number): Design {
  const id = String(row.id ?? `dress-${index + 1}`);
  const name = cleanText(row.name, `Glowmia Design ${index + 1}`);
  const category = normalizeCategory(row.category, row.occasion, row.style);
  const coverImage = cleanText(row.cover_image_url, cleanText(row.image_url, FALLBACK_IMAGE));
  const detailImage = resolveDetailImage(row, coverImage, coverImage);
  const normalizedGalleryImages = normalizeGalleryImages(row, detailImage || coverImage);
  const galleryImages = Array.from(new Set([detailImage, ...normalizedGalleryImages].filter(Boolean)));
  const description = normalizeTextValue(row.description, buildDescriptionFallback(row));
  const descriptionAr = normalizeTextValue(row.description_ar, buildArabicDescriptionFallback(row));
  const subtitle = buildSubtitleValue(row, 'en');
  const subtitleAr = buildSubtitleValue(row, 'ar');

  return {
    id,
    slug: buildDesignSlug(id, name),
    name: toBilingualText(name, row.name_ar, `Glowmia Design ${index + 1}`),
    subtitle: {
      en: subtitle,
      ar: subtitleAr,
    },
    description: {
      en: description,
      ar: descriptionAr,
    },
    story: {
      en: description,
      ar: descriptionAr,
    },
    category,
    categoryLabel: buildCategoryLabel(row),
    occasion: toBilingualText(row.occasion, row.occasion_ar, 'Occasion pending'),
    color: toBilingualText(row.color, row.color_ar, 'Color pending'),
    sleeveType: toBilingualText(row.sleeve_type, row.sleeve_type_ar, 'Sleeve pending'),
    length: toBilingualText(row.length, row.length_ar, 'Length pending'),
    style: toBilingualText(row.style, row.style_ar, titleCase(category === 'other' ? 'signature' : category)),
    fabric: toBilingualText(row.fabric, row.fabric_ar, 'Fabric pending'),
    fit: toBilingualText(row.fit, row.fit_ar, 'Fit pending'),
    coverImage,
    coverImagePosition: 'center top',
    detailImage,
    galleryImages,
    isFeatured: Boolean(row.is_featured) || index < 3,
    isNew: isRecentDress(row.created_at, index),
  };
}

export function localizeText(language: Language, value: LocalizedText) {
  return value[language];
}

export function getDesignCategoryLabel(category: DesignCategory): LocalizedText {
  if (category === 'evening') {
    return { en: 'Evening', ar: 'مسائي' };
  }

  if (category === 'formal') {
    return { en: 'Formal', ar: 'رسمي' };
  }

  if (category === 'casual') {
    return { en: 'Casual', ar: 'كاجوال' };
  }

  return { en: 'Signature', ar: 'مميز' };
}

export function getFeaturedDesignsFromList(designs: Design[]) {
  return designs.filter((design) => design.isFeatured).slice(0, 3);
}

export function getDesignBySlug(designs: Design[], slug: string) {
  const exactMatch = designs.find((design) => design.slug === slug);

  if (exactMatch) {
    return exactMatch;
  }

  const slugId = slug.split('--').pop();

  if (!slugId) {
    return null;
  }

  return designs.find((design) => design.id === slugId) ?? null;
}

export function getRelatedDesignsFromList(designs: Design[], current: Design, limit = 3) {
  return designs
    .filter((design) => design.slug !== current.slug)
    .sort((a, b) => {
      const scoreA = Number(a.category === current.category) + Number(a.isFeatured);
      const scoreB = Number(b.category === current.category) + Number(b.isFeatured);
      return scoreB - scoreA;
    })
    .slice(0, limit);
}
