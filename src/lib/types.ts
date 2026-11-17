export const CATEGORIES = ['movies', 'tv', 'games', 'sports', 'tech', 'world'] as const;
export type Category = (typeof CATEGORIES)[number];

export const KINDS = ['movie', 'tv', 'game', 'article', 'event'] as const;
export type ContentKind = (typeof KINDS)[number];

export type SourceId =
  | 'tmdb'
  | 'rawg'
  | 'tvmaze'
  | 'wikipedia'
  | 'hn'
  | 'spaceflight'
  | 'espn'
  | 'rss'
  | 'demo';

export interface Popularity {
  /** A real, source-reported number. Never synthesized. */
  value: number;
  /** i18n key describing what the number means. */
  metric: 'tmdbPopularity' | 'rawgAdded' | 'wikiViews' | 'hnPoints';
}

export interface ContentItem {
  /** `${source}:${kind}:${sourceId}` — stable across sessions. */
  id: string;
  source: SourceId;
  kind: ContentKind;
  category: Category;
  subcategory?: string;
  title: string;
  subtitle?: string;
  description?: string;
  /** Wide image (backdrop / article image). */
  image?: string;
  /** Portrait image (poster / cover). */
  poster?: string;
  /** ISO date or datetime: release, air or publication date. */
  date?: string;
  /** Link to the original source. */
  url?: string;
  sourceName?: string;
  rating?: number;
  genres?: string[];
  platforms?: string[];
  popularity?: Popularity;
  /** Free-form facts shown on cards (e.g. score lines for sports events). */
  meta?: Record<string, string | number | undefined>;
  /** Sample content shipped with the app. Always labelled in the UI. */
  isDemo?: boolean;
}

export type WatchStatus = 'planned' | 'active' | 'completed';

export interface SourceStatus {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  needsKey?: 'tmdb' | 'rawg';
}

export interface FeedResult {
  items: ContentItem[];
  sources: SourceStatus[];
}

export interface Trailer {
  key: string;
  name: string;
  site: 'YouTube';
}

export interface Person {
  name: string;
  role?: string;
  image?: string;
}

export interface DetailResult {
  item: ContentItem;
  facts: { label: string; value: string }[];
  trailers: Trailer[];
  cast: Person[];
  gallery: string[];
  related: ContentItem[];
  /** True when details came from a live API call (vs. a stored snapshot). */
  live: boolean;
}

export type Accent = 'cyan' | 'turquoise' | 'blue' | 'violet' | 'rose' | 'amber';
export type ThemeMode = 'dark' | 'light' | 'system';
export type Language = 'en' | 'he';

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  category: Category;
  subcategory?: string;
  enabled: boolean;
  lang?: Language;
}

export type HomeSection =
  | 'quick'
  | 'featured'
  | 'latest'
  | 'trending'
  | 'recommended'
  | 'upcoming'
  | 'recent';

export interface Settings {
  name: string;
  onboarded: boolean;
  theme: ThemeMode;
  accent: Accent;
  language: Language;
  enabledCategories: Category[];
  favoriteCategories: Category[];
  contentTypes: ContentKind[];
  homeSections: Record<HomeSection, boolean>;
  region: string;
  tmdbKey: string;
  rawgKey: string;
  rssProxies: string[];
  rssFeeds: RssFeed[];
  sportsLeagues: string[];
  notifications: {
    enabled: boolean;
    releaseReminders: boolean;
    releaseLeadDays: number;
    savedDigest: boolean;
  };
  lastDigestAt: number;
}
