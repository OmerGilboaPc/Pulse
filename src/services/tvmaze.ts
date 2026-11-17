import type { ContentItem, DetailResult } from '../lib/types';
import { stripHtml } from '../lib/format';
import { fetchJson, mapLimit } from './http';

const API = 'https://api.tvmaze.com';

interface MazeShow {
  id: number;
  name: string;
  url: string;
  officialSite?: string | null;
  summary?: string | null;
  premiered?: string | null;
  ended?: string | null;
  status?: string;
  genres?: string[];
  language?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  rating?: { average?: number | null };
  network?: { name: string; country?: { code: string } } | null;
  webChannel?: { name: string } | null;
  image?: { medium?: string; original?: string } | null;
  _embedded?: {
    cast?: { person: { name: string; image?: { medium?: string } | null }; character: { name: string } }[];
    nextepisode?: { airdate?: string; name?: string; season?: number; number?: number };
    images?: { type: string; resolutions: { original?: { url: string } } }[];
  };
}

interface MazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number | null;
  airdate: string;
  airstamp?: string;
  show?: MazeShow;
  _embedded?: { show: MazeShow };
}

export function mapShow(s: MazeShow): ContentItem {
  return {
    id: `tvmaze:tv:${s.id}`,
    source: 'tvmaze',
    kind: 'tv',
    category: 'tv',
    title: s.name,
    description: stripHtml(s.summary) || undefined,
    image: s.image?.original ?? undefined,
    poster: s.image?.medium ?? undefined,
    date: s.premiered ?? undefined,
    url: s.url,
    sourceName: 'TVmaze',
    rating: s.rating?.average ?? undefined,
    genres: s.genres ?? [],
    meta: { network: s.network?.name ?? s.webChannel?.name },
  };
}

const showOf = (e: MazeEpisode) => e.show ?? e._embedded?.show;

export const tvmaze = {
  /** Episodes airing on a date: broadcast (country) + streaming (web). */
  async schedule(date: string, country: string) {
    const [tv, web] = await Promise.allSettled([
      fetchJson<MazeEpisode[]>(`${API}/schedule?country=${encodeURIComponent(country)}&date=${date}`),
      fetchJson<MazeEpisode[]>(`${API}/schedule/web?date=${date}`),
    ]);
    if (tv.status === 'rejected' && web.status === 'rejected') throw tv.reason;
    return [...(tv.status === 'fulfilled' ? tv.value : []), ...(web.status === 'fulfilled' ? web.value : [])];
  },

  /** Shows airing today, deduplicated, best-rated first. */
  async airingToday(date: string, country: string): Promise<ContentItem[]> {
    const eps = await this.schedule(date, country);
    const seen = new Map<number, ContentItem>();
    for (const e of eps) {
      const s = showOf(e);
      if (!s || seen.has(s.id) || !s.image) continue;
      const item = mapShow(s);
      seen.set(s.id, {
        ...item,
        subtitle: `S${e.season}${e.number ? ` · E${e.number}` : ''}${e.name ? ` — ${e.name}` : ''}`,
        meta: { ...item.meta, airstamp: e.airstamp },
      });
    }
    return [...seen.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  },

  /** Series & season premieres (episode 1) within the next `days` days. */
  async premieres(days: number, country: string): Promise<ContentItem[]> {
    const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10));
    const results = await mapLimit(dates, 4, (d) => this.schedule(d, country));
    if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
    const out = new Map<string, ContentItem>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const e of r.value) {
        const s = showOf(e);
        if (!s || e.number !== 1) continue;
        const key = `${s.id}-${e.season}`;
        if (out.has(key)) continue;
        const base = mapShow(s);
        out.set(key, {
          ...base,
          date: e.airdate,
          subtitle: e.season === 1 ? 'seriesPremiere' : `S${e.season}`,
          meta: { ...base.meta, season: e.season },
        });
      }
    }
    return [...out.values()];
  },

  async search(query: string): Promise<ContentItem[]> {
    const r = await fetchJson<{ score: number; show: MazeShow }[]>(`${API}/search/shows?q=${encodeURIComponent(query)}`);
    return r.map((x) => mapShow(x.show));
  },

  async details(id: string): Promise<DetailResult> {
    const s = await fetchJson<MazeShow>(`${API}/shows/${id}?embed[]=cast&embed[]=nextepisode&embed[]=images`);
    const item = mapShow(s);
    const background = s._embedded?.images?.find((i) => i.type === 'background')?.resolutions.original?.url;
    const facts: DetailResult['facts'] = [];
    if (s.premiered) facts.push({ label: 'firstAired', value: s.premiered });
    if (s.ended) facts.push({ label: 'ended', value: s.ended });
    if (s.status) facts.push({ label: 'status', value: s.status });
    const network = s.network?.name ?? s.webChannel?.name;
    if (network) facts.push({ label: 'network', value: network });
    const runtime = s.runtime ?? s.averageRuntime;
    if (runtime) facts.push({ label: 'runtime', value: `${runtime} min` });
    if (s._embedded?.nextepisode?.airdate) facts.push({ label: 'nextEpisode', value: s._embedded.nextepisode.airdate });
    if (s.language) facts.push({ label: 'language', value: s.language });
    if (s.officialSite) facts.push({ label: 'website', value: s.officialSite });
    return {
      item: { ...item, image: background ?? item.image },
      facts,
      trailers: [],
      cast: (s._embedded?.cast ?? []).slice(0, 14).map((c) => ({
        name: c.person.name,
        role: c.character.name,
        image: c.person.image?.medium,
      })),
      gallery: [],
      related: [],
      live: true,
    };
  },
};
