import type { ContentItem, DetailResult, Trailer } from '../lib/types';
import { stripHtml } from '../lib/format';
import { fetchJson, HttpError, qs } from './http';

const API = 'https://api.rawg.io/api';

export const PLATFORM_FILTERS = [
  { id: 1, name: 'PC' },
  { id: 2, name: 'PlayStation' },
  { id: 3, name: 'Xbox' },
  { id: 7, name: 'Nintendo' },
  { id: 4, name: 'iOS' },
  { id: 8, name: 'Android' },
];

interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released?: string | null;
  tba?: boolean;
  background_image?: string | null;
  rating?: number;
  ratings_count?: number;
  metacritic?: number | null;
  added?: number;
  genres?: { name: string; slug: string }[];
  parent_platforms?: { platform: { id: number; name: string } }[];
  platforms?: { platform: { id: number; name: string } }[];
  short_screenshots?: { image: string }[];
}

interface RawgDetail extends RawgGame {
  description_raw?: string;
  description?: string;
  website?: string;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  esrb_rating?: { name: string } | null;
  playtime?: number;
}

/** RAWG's CDN can serve resized crops: /media/crop/W/H/... */
export function rawgResize(url: string | null | undefined, w = 640, h = 360) {
  if (!url) return undefined;
  return url.replace('/media/games/', `/media/crop/${w}/${h}/games/`).replace('/media/screenshots/', `/media/crop/${w}/${h}/screenshots/`);
}

async function call<T>(key: string, path: string, params: Record<string, string | number | undefined> = {}) {
  if (!key) throw new HttpError('config', 'RAWG key missing');
  return fetchJson<T>(`${API}${path}?${qs({ key, ...params })}`);
}

export function mapGame(g: RawgGame): ContentItem {
  return {
    id: `rawg:game:${g.id}`,
    source: 'rawg',
    kind: 'game',
    category: 'games',
    title: g.name,
    image: rawgResize(g.background_image, 1280, 720),
    poster: rawgResize(g.background_image, 600, 800),
    date: g.released ?? undefined,
    url: `https://rawg.io/games/${g.slug}`,
    sourceName: 'RAWG',
    rating: g.rating && g.ratings_count && g.ratings_count > 5 ? g.rating * 2 : undefined,
    genres: g.genres?.map((x) => x.name) ?? [],
    platforms: (g.parent_platforms ?? []).map((p) => p.platform.name),
    popularity: g.added ? { value: g.added, metric: 'rawgAdded' } : undefined,
    meta: { slug: g.slug, genreSlug: g.genres?.[0]?.slug, metacritic: g.metacritic ?? undefined },
  };
}

type Paged = { results: RawgGame[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => iso(new Date(Date.now() + days * 864e5));

export const rawg = {
  async list(key: string, params: Record<string, string | number | undefined>) {
    const r = await call<Paged>(key, '/games', { page_size: 24, ...params });
    return r.results.map(mapGame);
  },
  popular(key: string, platform?: number) {
    return this.list(key, { dates: `${shift(-365)},${shift(0)}`, ordering: '-added', parent_platforms: platform });
  },
  newReleases(key: string, platform?: number) {
    return this.list(key, { dates: `${shift(-45)},${shift(0)}`, ordering: '-added', parent_platforms: platform });
  },
  upcoming(key: string, platform?: number, days = 365) {
    return this.list(key, { dates: `${shift(1)},${shift(days)}`, ordering: '-added', parent_platforms: platform, page_size: 40 });
  },
  trending(key: string) {
    return this.list(key, { dates: `${shift(-90)},${shift(0)}`, ordering: '-added', page_size: 20 });
  },
  topRated(key: string) {
    return this.list(key, { dates: `${shift(-730)},${shift(0)}`, ordering: '-metacritic', page_size: 20 });
  },
  search(key: string, query: string) {
    return this.list(key, { search: query, search_precise: 'true', page_size: 20 });
  },
  byGenre(key: string, genreSlug: string) {
    return this.list(key, { genres: genreSlug, ordering: '-added', page_size: 16 });
  },
  async details(key: string, id: string): Promise<DetailResult> {
    const [d, shots, movies] = await Promise.all([
      call<RawgDetail>(key, `/games/${id}`),
      call<{ results: { image: string }[] }>(key, `/games/${id}/screenshots`).catch(() => ({ results: [] })),
      call<{ results: { name: string; data?: { max?: string; '480'?: string } }[] }>(key, `/games/${id}/movies`).catch(() => ({ results: [] })),
    ]);
    const item: ContentItem = {
      ...mapGame(d),
      description: d.description_raw || stripHtml(d.description) || undefined,
      platforms: (d.platforms ?? d.parent_platforms ?? []).map((p) => p.platform.name),
    };
    const facts: DetailResult['facts'] = [];
    facts.push({ label: 'release', value: d.released ?? (d.tba ? 'TBA' : '—') });
    if (d.developers?.length) facts.push({ label: 'developer', value: d.developers.map((x) => x.name).join(', ') });
    if (d.publishers?.length) facts.push({ label: 'publisher', value: d.publishers.map((x) => x.name).join(', ') });
    if (d.metacritic) facts.push({ label: 'metacritic', value: String(d.metacritic) });
    if (d.rating && d.ratings_count) facts.push({ label: 'rawgRating', value: `${d.rating.toFixed(2)} / 5 · ${d.ratings_count.toLocaleString()} ratings` });
    if (d.playtime) facts.push({ label: 'playtime', value: `${d.playtime} h` });
    if (d.esrb_rating?.name) facts.push({ label: 'esrb', value: d.esrb_rating.name });
    if (d.website) facts.push({ label: 'website', value: d.website });

    let related: ContentItem[] = [];
    const genre = d.genres?.[0]?.slug;
    if (genre) {
      try {
        related = (await this.byGenre(key, genre)).filter((g) => g.id !== item.id).slice(0, 12);
      } catch {
        related = [];
      }
    }
    const trailers: Trailer[] = [];
    // RAWG clips are direct MP4s, not YouTube — surface them as gallery video links instead.
    const clip = movies.results.find((m) => m.data?.max || m.data?.['480']);
    return {
      item: clip ? { ...item, meta: { ...item.meta, clip: clip.data?.max ?? clip.data?.['480'] } } : item,
      facts,
      trailers,
      cast: [],
      gallery: shots.results.slice(0, 10).map((s) => rawgResize(s.image, 1280, 720)!),
      related,
      live: true,
    };
  },
  async verify(key: string) {
    await call<unknown>(key, '/genres', { page_size: 1 });
  },
};
