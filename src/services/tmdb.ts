import type { ContentItem, DetailResult, Language, Person, Trailer } from '../lib/types';
import { fetchJson, HttpError, qs } from './http';

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export interface TmdbConfig {
  key: string;
  language: Language;
  region: string;
}

const MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller',
  10752: 'War', 37: 'Western',
};
const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

export const MOVIE_GENRE_FILTERS = [28, 35, 18, 878, 27, 16, 53, 10749, 99];
export const movieGenreName = (id: number) => MOVIE_GENRES[id] ?? '';

interface TmdbMedia {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  overview?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
}

interface Paged<T> {
  results: T[];
}

function language(l: Language) {
  return l === 'he' ? 'he-IL' : 'en-US';
}

export function isBearer(key: string) {
  return key.startsWith('eyJ') && key.length > 60;
}

async function call<T>(cfg: TmdbConfig, path: string, params: Record<string, string | number | undefined> = {}) {
  if (!cfg.key) throw new HttpError('config', 'TMDB key missing');
  const bearer = isBearer(cfg.key);
  const query = qs({ language: language(cfg.language), ...params, ...(bearer ? {} : { api_key: cfg.key }) });
  return fetchJson<T>(`${API}${path}?${query}`, {
    headers: bearer ? { Authorization: `Bearer ${cfg.key}`, accept: 'application/json' } : { accept: 'application/json' },
  });
}

export const tmdbImage = (path: string | null | undefined, size: string) => (path ? `${IMG}/${size}${path}` : undefined);

export function mapMedia(m: TmdbMedia, forced?: 'movie' | 'tv'): ContentItem | null {
  const type = forced ?? m.media_type;
  if (type !== 'movie' && type !== 'tv') return null;
  const isMovie = type === 'movie';
  const genreNames = m.genres?.map((g) => g.name) ?? (m.genre_ids ?? []).map((g) => (isMovie ? MOVIE_GENRES : TV_GENRES)[g]).filter(Boolean);
  return {
    id: `tmdb:${type}:${m.id}`,
    source: 'tmdb',
    kind: type,
    category: isMovie ? 'movies' : 'tv',
    title: (isMovie ? m.title : m.name) ?? m.title ?? m.name ?? 'Untitled',
    description: m.overview || undefined,
    image: tmdbImage(m.backdrop_path, 'w1280'),
    poster: tmdbImage(m.poster_path, 'w500'),
    date: (isMovie ? m.release_date : m.first_air_date) || undefined,
    url: `https://www.themoviedb.org/${type}/${m.id}`,
    sourceName: 'TMDB',
    rating: m.vote_count && m.vote_count > 10 ? m.vote_average : undefined,
    genres: genreNames,
    popularity: m.popularity ? { value: m.popularity, metric: 'tmdbPopularity' } : undefined,
  };
}

const mapList = (r: Paged<TmdbMedia>, forced?: 'movie' | 'tv') =>
  r.results.map((m) => mapMedia(m, forced)).filter((x): x is ContentItem => !!x);

export const tmdb = {
  async trending(cfg: TmdbConfig, type: 'all' | 'movie' | 'tv', window: 'day' | 'week' = 'week') {
    const r = await call<Paged<TmdbMedia>>(cfg, `/trending/${type}/${window}`);
    return mapList(r, type === 'all' ? undefined : type);
  },
  async popularMovies(cfg: TmdbConfig, genre?: number) {
    if (genre) {
      const r = await call<Paged<TmdbMedia>>(cfg, '/discover/movie', { sort_by: 'popularity.desc', with_genres: genre, 'vote_count.gte': 50 });
      return mapList(r, 'movie');
    }
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/movie/popular', { region: cfg.region }), 'movie');
  },
  async nowPlaying(cfg: TmdbConfig) {
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/movie/now_playing', { region: cfg.region }), 'movie');
  },
  async topRatedMovies(cfg: TmdbConfig) {
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/movie/top_rated'), 'movie');
  },
  async popularTv(cfg: TmdbConfig) {
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/tv/popular'), 'tv');
  },
  async topRatedTv(cfg: TmdbConfig) {
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/tv/top_rated'), 'tv');
  },
  async airingToday(cfg: TmdbConfig) {
    return mapList(await call<Paged<TmdbMedia>>(cfg, '/tv/airing_today'), 'tv');
  },
  async upcomingMovies(cfg: TmdbConfig, from: string, to: string) {
    const pages = await Promise.all(
      [1, 2].map((page) =>
        call<Paged<TmdbMedia>>(cfg, '/discover/movie', {
          region: cfg.region,
          'primary_release_date.gte': from,
          'primary_release_date.lte': to,
          sort_by: 'popularity.desc',
          with_release_type: '2|3',
          page,
        }),
      ),
    );
    return pages.flatMap((p) => mapList(p, 'movie'));
  },
  async tvPremieres(cfg: TmdbConfig, from: string, to: string) {
    const r = await call<Paged<TmdbMedia>>(cfg, '/discover/tv', {
      'first_air_date.gte': from,
      'first_air_date.lte': to,
      sort_by: 'popularity.desc',
      'with_original_language': undefined,
    });
    return mapList(r, 'tv');
  },
  async search(cfg: TmdbConfig, query: string) {
    const r = await call<Paged<TmdbMedia>>(cfg, '/search/multi', { query, include_adult: 'false' });
    return mapList(r);
  },
  async trailersFor(cfg: TmdbConfig, item: ContentItem): Promise<Trailer[]> {
    const [, type, id] = item.id.split(':');
    const r = await call<{ results: TmdbVideo[] }>(cfg, `/${type}/${id}/videos`, { language: undefined });
    return pickTrailers(r.results);
  },
  async details(cfg: TmdbConfig, type: 'movie' | 'tv', id: string): Promise<DetailResult> {
    const d = await call<TmdbDetail>(cfg, `/${type}/${id}`, {
      append_to_response: 'videos,credits,recommendations,images',
      include_video_language: 'en,null,he',
      include_image_language: 'en,null',
    });
    let overview = d.overview;
    if (!overview && cfg.language !== 'en') {
      try {
        overview = (await call<TmdbDetail>({ ...cfg, language: 'en' }, `/${type}/${id}`)).overview;
      } catch {
        /* keep empty */
      }
    }
    const item = mapMedia({ ...d, overview }, type)!;
    const facts: DetailResult['facts'] = [];
    if (type === 'movie') {
      if (d.release_date) facts.push({ label: 'release', value: d.release_date });
      if (d.runtime) facts.push({ label: 'runtime', value: `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` });
      const director = d.credits?.crew?.find((c) => c.job === 'Director');
      if (director) facts.push({ label: 'director', value: director.name });
    } else {
      if (d.first_air_date) facts.push({ label: 'firstAired', value: d.first_air_date });
      if (d.number_of_seasons) facts.push({ label: 'seasons', value: String(d.number_of_seasons) });
      if (d.networks?.length) facts.push({ label: 'network', value: d.networks.map((n) => n.name).join(', ') });
      if (d.next_episode_to_air?.air_date) facts.push({ label: 'nextEpisode', value: d.next_episode_to_air.air_date });
      const creators = d.created_by?.map((c) => c.name).join(', ');
      if (creators) facts.push({ label: 'createdBy', value: creators });
    }
    if (d.status) facts.push({ label: 'status', value: d.status });
    if (d.vote_count && d.vote_average) facts.push({ label: 'tmdbScore', value: `${d.vote_average.toFixed(1)} / 10 · ${d.vote_count.toLocaleString()} votes` });
    if (d.original_language) facts.push({ label: 'language', value: d.original_language.toUpperCase() });
    const cast: Person[] = (d.credits?.cast ?? []).slice(0, 14).map((c) => ({
      name: c.name,
      role: c.character,
      image: tmdbImage(c.profile_path, 'w185'),
    }));
    const gallery = (d.images?.backdrops ?? []).slice(0, 8).map((b) => tmdbImage(b.file_path, 'w780')!).filter(Boolean);
    return {
      item: { ...item, meta: d.tagline ? { tagline: d.tagline } : undefined },
      facts,
      trailers: pickTrailers(d.videos?.results ?? []),
      cast,
      gallery,
      related: mapList(d.recommendations ?? { results: [] }, type).slice(0, 16),
      live: true,
    };
  },
  async verify(key: string) {
    await call<unknown>({ key, language: 'en', region: 'US' }, '/configuration', { language: undefined });
  },
};

interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
}

interface TmdbDetail extends TmdbMedia {
  runtime?: number;
  status?: string;
  tagline?: string;
  original_language?: string;
  number_of_seasons?: number;
  networks?: { name: string }[];
  created_by?: { name: string }[];
  next_episode_to_air?: { air_date?: string };
  videos?: { results: TmdbVideo[] };
  credits?: { cast?: { name: string; character?: string; profile_path?: string | null }[]; crew?: { name: string; job: string }[] };
  recommendations?: Paged<TmdbMedia>;
  images?: { backdrops?: { file_path: string }[] };
}

function pickTrailers(videos: TmdbVideo[]): Trailer[] {
  return videos
    .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
    .sort((a, b) => Number(b.type === 'Trailer') - Number(a.type === 'Trailer') || Number(!!b.official) - Number(!!a.official))
    .slice(0, 4)
    .map((v) => ({ key: v.key, name: v.name, site: 'YouTube' as const }));
}
