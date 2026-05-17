import type { Language } from '@/src/content/glowmia';
import { normalizePrice } from '@/src/lib/pricing';

export type LocalizedText = {
  en: string;
  ar: string;
};

export type DesignCategory = 'evening' | 'casual' | 'formal' | 'other';

export type Design = {
  id: string;
  slug: string;
  priceSar: number;
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
  price: number | null;
  coverImage: string;
  coverImagePosition?: string;
  detailImage?: string;
  galleryImages: string[];
  isFeatured: boolean;
  isVisible: boolean;
  displayOrder: number;
  homepageSection: string | null;
  collectionSection: string | null;
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
  price?: number | string | null;
  price_egp?: number | string | null;
  image_url?: string | null;
  front_view_url?: string | null;
  side_view_url?: string | null;
  back_view_url?: string | null;
  created_at?: string | null;
  is_featured?: boolean | null;
  display_order?: number | null;
  homepage_section?: string | null;
  collection_section?: string | null;
  is_visible?: boolean | null;
  gallery_image_urls?: string[] | null;
  gallery_images?: string[] | null;
  image_urls?: string[] | null;
};

export const designCategories: DesignCategory[] = ['evening', 'casual', 'formal', 'other'];

const FALLBACK_IMAGE = '/glowmia-logo.svg';
const TEMPORARY_PRICE_BY_ID: Record<string, number> = {
  'fc159002-ae07-46d7-a607-0aa39db217eb': 256,
  'c26a0550-94ba-4898-95b4-8160d0317915': 289,
  '606916b9-e0c4-4c12-b0a6-b56343f47cdb': 315,
  'c535cfd2-b456-4ba0-ac6a-05d9c2cb1d92': 230,
  'fdc2c0ce-ab77-4b19-b006-085c65002b9d': 340,
  'df2bfef5-b1a5-4ec0-8286-61ddd559b67e': 275,
  'ab7f52b3-d9fd-4bb9-a41b-c7da8caf3904': 299,
  '9480270f-ce74-4230-aa99-3769b1e708cd': 325,
  '3f7c532f-818c-40e5-ae05-6da34a9854fd': 260,
  '2d6323e7-2d6f-4de9-9f04-383df637fbc4': 390,
};

function getTemporaryDesignPrice(id: string, index: number) {
  return TEMPORARY_PRICE_BY_ID[id] ?? 250 + index * 15;
}

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
  const viewImages = [row.side_view_url, row.back_view_url]
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());

  if (viewImages.length > 0) {
    return viewImages;
  }

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

function buildDesignPriceSar(seed: string) {
  const hash = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return 150 + (hash % 151);
}

export function buildDesignSlug(id: string, name: string) {
  const base = slugify(name || 'design');
  return `${base || 'design'}--${id}`;
}

export function normalizeDressRow(row: DressRow, index: number): Design {
  const id = String(row.id ?? `dress-${index + 1}`);
  const name = cleanText(row.name, `Glowmia Design ${index + 1}`);
  const category = normalizeCategory(row.category, row.occasion, row.style);
  const coverImage = cleanText(row.front_view_url, cleanText(row.image_url, FALLBACK_IMAGE));
  const detailImage = resolveDetailImage(row, coverImage, coverImage);
  const normalizedGalleryImages = normalizeGalleryImages(row, detailImage || coverImage);
  const galleryImages = Array.from(new Set([detailImage, ...normalizedGalleryImages].filter(Boolean)));
  const description = normalizeTextValue(row.description, buildDescriptionFallback(row));
  const descriptionAr = normalizeTextValue(row.description_ar, buildArabicDescriptionFallback(row));
  const subtitle = buildSubtitleValue(row, 'en');
  const subtitleAr = buildSubtitleValue(row, 'ar');
  const rowPrice = normalizePrice(row.price ?? row.price_egp);

  const homepageSection = cleanText(row.homepage_section, '') || null;
  const collectionSection = cleanText(row.collection_section, '') || null;
  const hasExplicitFeaturedFlag = typeof row.is_featured === 'boolean' || Boolean(homepageSection);
  const isFeatured = hasExplicitFeaturedFlag ? Boolean(row.is_featured) || homepageSection === 'featured' : index < 3;
  const isVisible = row.is_visible !== false;
  const displayOrder = Number.isFinite(Number(row.display_order)) ? Number(row.display_order) : 0;

  return {
    id,
    slug: buildDesignSlug(id, name),
    priceSar: buildDesignPriceSar(`${id}-${name}-${index}`),
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
    price: rowPrice ?? getTemporaryDesignPrice(id, index),
    coverImage,
    coverImagePosition: 'center top',
    detailImage,
    galleryImages,
    isFeatured,
    isVisible,
    displayOrder,
    homepageSection,
    collectionSection,
    isNew: isRecentDress(row.created_at, index),
  };
}

export function localizeText(language: Language, value: LocalizedText) {
  return value[language];
}

export function formatDesignPrice(priceSar: number) {
  return `${priceSar} SAR`;
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
  const featuredDesigns = designs.filter((design) => design.isFeatured);
  const sourceDesigns = featuredDesigns.length > 0 ? featuredDesigns : designs;

  return [...sourceDesigns]
    .sort((left, right) => {
      const sectionScore = Number(right.homepageSection === 'featured') - Number(left.homepageSection === 'featured');

      if (sectionScore !== 0) {
        return sectionScore;
      }

      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }

      return right.id.localeCompare(left.id);
    })
    .slice(0, 3);
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
