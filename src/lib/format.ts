import type { Language } from './types';

const locales: Record<Language, string> = { en: 'en-US', he: 'he-IL' };
export const localeOf = (lang: Language) => locales[lang];

/** Parse "YYYY-MM-DD" as a local calendar date (not UTC midnight). */
export function parseDate(value?: string | number | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return new Date(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDateOnly(value?: string) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local "YYYY-MM-DD". */
export function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysUntil(value?: string): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const ms = startOfDay(d).getTime() - startOfDay(new Date()).getTime();
  return Math.round(ms / 864e5);
}

export function formatDate(value: string | number | undefined, lang: Language, opts?: Intl.DateTimeFormatOptions) {
  const d = parseDate(value ?? null);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeOf(lang), opts ?? { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function formatDateTime(value: number | string, lang: Language) {
  const d = parseDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeOf(lang), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function relativeTime(value: string | number | undefined, lang: Language) {
  const d = parseDate(value ?? null);
  if (!d) return '';
  if (typeof value === 'string' && isDateOnly(value)) {
    const days = daysUntil(value) ?? 0;
    if (Math.abs(days) > 6) return formatDate(value, lang);
    return new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'auto' }).format(days, 'day');
  }
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(value, lang);
}

export function compactNumber(n: number, lang: Language) {
  return new Intl.NumberFormat(localeOf(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number, lang: Language) {
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 }).format(n);
}

export function yearOf(value?: string) {
  const d = parseDate(value);
  return d ? String(d.getFullYear()) : '';
}

const ENTITY: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

/** Strip HTML tags and decode common entities without touching the DOM. */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITY[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s: string | undefined, n: number) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function hostnameOf(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
