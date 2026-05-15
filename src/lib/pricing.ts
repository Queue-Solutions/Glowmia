export const DEFAULT_CURRENCY = 'SAR';

export function getPriceLocale(language: 'en' | 'ar') {
  return language === 'ar' ? 'ar-SA' : 'en-SA';
}

export function normalizePrice(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.round(numericValue * 100) / 100;
}

export function formatPrice(value: number | null | undefined, locale: string, currency = DEFAULT_CURRENCY) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  const formattedValue = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);

  return `${currency} ${formattedValue}`;
}

export function calculateDiscountAmount(subtotal: number, percentage: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(percentage) || percentage <= 0) {
    return 0;
  }

  return Math.round(subtotal * Math.min(100, percentage) * 100) / 10000;
}
