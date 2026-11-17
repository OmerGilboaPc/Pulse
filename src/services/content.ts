import type { Category, ContentItem, DetailResult, FeedResult, RssFeed, Settings, SourceStatus } from '../lib/types';
import { db, rememberItems, type WatchEntry } from '../lib/db';
import { LEAGUES } from '../lib/defaults';
import { tmdb, type TmdbConfig } from './tmdb';
import { rawg } from './rawg';
import { tvmaze } from './tvmaze';
import { espn, fetchFeed, hackerNews, spaceflight, wikipediaDigest } from './news';
import { DEMO_ITEMS } from './demo';
import { HttpError } from './http';
import { daysUntil, ymd } from '../lib/format';

/* ---------- small in-session memo so parallel screens share requests ---------- */
const memoStore = new Map<string, { at: number; p: Promise<unknown> }>();
function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memoStore.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = fn().then(
    (v) => {
      if (Array.isArray(v)) void rememberItems(v as ContentItem[]);
      return v;
    },
    (e) => {
      memoStore.delete(key);
      throw e;
    },
  );
  memoStore.set(key, { at: Date.now(), p });
  return p;
}
export function clearMemo() {
  memoStore.clear();
}

const MIN = 60_000;
export const tmdbCfg = (s: Settings): TmdbConfig => ({ key: s.tmdbKey.trim(), language: s.language, region: s.region });
export const hasTmdb = (s: Settings) => s.tmdbKey.trim().length > 0;
export const hasRawg = (s: Settings) => s.rawgKey.trim().length > 0;
const on = (s: Settings, c: Category) => s.enabledCategories.includes(c);

function describeError(e: unknown) {
  if (e instanceof HttpError) return e.kind;
  return 'network';
}

interface Task {
  id: string;
  name: string;
  run: () => Promise<ContentItem[]>;
}

async function collect(tasks: Task[]): Promise<FeedResult> {
  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const sources: SourceStatus[] = [];
  const items: ContentItem[] = [];
  settled.forEach((r, i) => {
    const t = tasks[i];
    if (r.status === 'fulfilled') {
      items.push(...r.value);
      sources.push({ id: t.id, name: t.name, ok: true, count: r.value.length });
    } else {
      sources.push({ id: t.id, name: t.name, ok: false, count: 0, error: describeError(r.reason) });
    }
  });
  if (tasks.length && sources.every((x) => !x.ok)) {
    const err = new HttpError('network', 'All sources failed');
    (err as HttpError & { sources?: SourceStatus[] }).sources = sources;
    throw err;
  }
  return { items, sources };
}

export function dedupe(items: ContentItem[]) {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.url ? i.url.replace(/[?#].*$/, '') : i.id;
    const t = i.title.toLowerCase().slice(0, 60);
    if (seen.has(i.id) || seen.has(k) || seen.has(t)) return false;
    seen.add(i.id);
    seen.add(k);
    seen.add(t);
    return true;
  });
}

const byDateDesc = (a: ContentItem, b: ContentItem) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0);

/* ---------- shared, memoized source calls ---------- */
const src = {
  wiki: (s: Settings) => memo(`wiki:${s.language}`, 30 * MIN, () => wikipediaDigest(s.language)),
  hnFront: () => memo('hn:front', 10 * MIN, () => hackerNews.frontPage()),
  hnWeek: () => memo('hn:week', 30 * MIN, () => hackerNews.week()),
  space: () => memo('snapi', 20 * MIN, () => spaceflight.latest()),
  tmdbTrending: (s: Settings, type: 'all' | 'movie' | 'tv', w: 'day' | 'week' = 'week') =>
    memo(`tmdb:trending:${type}:${w}:${s.language}`, 30 * MIN, () => tmdb.trending(tmdbCfg(s), type, w)),
  rawgTrending: (s: Settings) => memo('rawg:trending', 60 * MIN, () => rawg.trending(s.rawgKey.trim())),
  espnNews: (league: string) => {
    const l = LEAGUES.find((x) => x.id === league);
    return memo(`espn:news:${league}`, 15 * MIN, () => espn.news(league, l?.name ?? league, l?.sport ?? 'other'));
  },
  espnScores: (league: string) => {
    const l = LEAGUES.find((x) => x.id === league);
    return memo(`espn:scores:${league}`, 3 * MIN, () => espn.scoreboard(league, l?.name ?? league, l?.sport ?? 'other'));
  },
  rss: (s: Settings, feed: RssFeed) =>
    memo(`rss:${feed.id}:${feed.url}:${s.rssProxies.join('|')}`, 15 * MIN, () => fetchFeed(feed, s.rssProxies)),
};

/** RSS as collect() tasks, one per feed so health is reported per source. */
function rssTasks(s: Settings, categories: Category[]): Task[] {
  return s.rssFeeds
    .filter((f) => f.enabled && categories.includes(f.category))
    .map((f) => ({ id: `rss:${f.id}`, name: f.name, run: () => src.rss(s, f) }));
}

/* ---------- Home ---------- */

export async function latestNews(s: Settings, categories: Category[] = s.enabledCategories): Promise<FeedResult> {
  const cats = categories.filter((c) => on(s, c));
  const tasks: Task[] = [...rssTasks(s, cats)];
  if (cats.includes('tech')) tasks.push({ id: 'hn', name: 'Hacker News', run: () => src.hnFront().then((x) => x.slice(0, 15)) });
  if (cats.includes('world')) {
    tasks.push({ id: 'spaceflight', name: 'Spaceflight News', run: () => src.space().then((x) => x.slice(0, 10)) });
    tasks.push({ id: 'wikipedia', name: 'Wikipedia', run: () => src.wiki(s).then((d) => d.inTheNews) });
  }
  if (cats.includes('sports')) {
    for (const league of s.sportsLeagues.slice(0, 3)) {
      tasks.push({ id: `espn:${league}`, name: `ESPN ${LEAGUES.find((l) => l.id === league)?.name ?? league}`, run: () => src.espnNews(league).then((x) => x.slice(0, 8)) });
    }
  }
  const r = await collect(tasks);
  return { ...r, items: dedupe(r.items).sort(byDateDesc) };
}

export async function featured(s: Settings): Promise<FeedResult> {
  const tasks: Task[] = [];
  if ((on(s, 'movies') || on(s, 'tv')) && hasTmdb(s)) {
    tasks.push({
      id: 'tmdb',
      name: 'TMDB',
      run: () =>
        src.tmdbTrending(s, 'all', 'day').then((x) => x.filter((i) => i.image && (on(s, i.category) || false)).slice(0, 4)),
    });
  } else if (on(s, 'tv')) {
    tasks.push({ id: 'tvmaze', name: 'TVmaze', run: () => tvAiring(s).then((x) => x.filter((i) => i.image).slice(0, 2)) });
  }
  if (on(s, 'games') && hasRawg(s)) {
    tasks.push({ id: 'rawg', name: 'RAWG', run: () => src.rawgTrending(s).then((x) => x.filter((i) => i.image).slice(0, 2)) });
  }
  if (on(s, 'world')) {
    tasks.push({
      id: 'wikipedia',
      name: 'Wikipedia',
      run: () => src.wiki(s).then((d) => [d.featured, d.picture].filter((x): x is ContentItem => !!x && !!x.image)),
    });
  }
  if (on(s, 'sports') && s.sportsLeagues[0]) {
    tasks.push({ id: 'espn', name: 'ESPN', run: () => src.espnNews(s.sportsLeagues[0]).then((x) => x.filter((i) => i.image).slice(0, 1)) });
  }
  if (on(s, 'world')) {
    tasks.push({ id: 'spaceflight', name: 'Spaceflight News', run: () => src.space().then((x) => x.filter((i) => i.image).slice(0, 1)) });
  }
  const r = await collect(tasks);
  // Interleave so the carousel alternates between interests, favorites first.
  const rank = (c: Category) => {
    const i = s.favoriteCategories.indexOf(c);
    return i === -1 ? 10 : i;
  };
  const groups = new Map<Category, ContentItem[]>();
  for (const it of r.items) groups.set(it.category, [...(groups.get(it.category) ?? []), it]);
  const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map((g) => g[1]);
  const out: ContentItem[] = [];
  for (let i = 0; out.length < 8 && ordered.some((g) => g[i]); i++) for (const g of ordered) if (g[i]) out.push(g[i]);
  return { ...r, items: out.slice(0, 8) };
}

export async function recommended(s: Settings, saved: WatchEntry[]): Promise<FeedResult & { basis?: string }> {
  const lastTmdb = saved.find((e) => e.item.source === 'tmdb');
  const lastRawg = saved.find((e) => e.item.source === 'rawg');
  const tasks: Task[] = [];
  let basis: string | undefined;
  if (lastTmdb && hasTmdb(s)) {
    const [, type, id] = lastTmdb.id.split(':');
    basis = lastTmdb.item.title;
    tasks.push({
      id: 'tmdb',
      name: 'TMDB',
      run: () => memo(`tmdb:rec:${lastTmdb.id}:${s.language}`, 60 * MIN, () => tmdb.details(tmdbCfg(s), type as 'movie' | 'tv', id).then((d) => d.related)),
    });
  }
  if (lastRawg && hasRawg(s) && lastRawg.item.meta?.genreSlug) {
    basis = basis ?? lastRawg.item.title;
    tasks.push({
      id: 'rawg',
      name: 'RAWG',
      run: () => memo(`rawg:genre:${lastRawg.item.meta?.genreSlug}`, 60 * MIN, () => rawg.byGenre(s.rawgKey.trim(), String(lastRawg.item.meta?.genreSlug))),
    });
  }
  if (!tasks.length) {
    // No saved titles yet: highest-rated picks from favorite categories.
    if (hasTmdb(s) && s.favoriteCategories.includes('movies') && on(s, 'movies')) {
      tasks.push({ id: 'tmdb', name: 'TMDB', run: () => memo(`tmdb:toprated:${s.language}`, 6 * 60 * MIN, () => tmdb.topRatedMovies(tmdbCfg(s))) });
    }
    if (hasTmdb(s) && s.favoriteCategories.includes('tv') && on(s, 'tv')) {
      tasks.push({ id: 'tmdb-tv', name: 'TMDB', run: () => memo(`tmdb:topratedtv:${s.language}`, 6 * 60 * MIN, () => tmdb.topRatedTv(tmdbCfg(s))) });
    }
    if (hasRawg(s) && s.favoriteCategories.includes('games') && on(s, 'games')) {
      tasks.push({ id: 'rawg', name: 'RAWG', run: () => memo('rawg:toprated', 6 * 60 * MIN, () => rawg.topRated(s.rawgKey.trim())) });
    }
    if (on(s, 'world') || s.favoriteCategories.includes('world')) {
      tasks.push({ id: 'wikipedia', name: 'Wikipedia', run: () => src.wiki(s).then((d) => [d.featured, ...d.onThisDay.slice(0, 6)].filter((x): x is ContentItem => !!x)) });
    }
    if (on(s, 'tech')) {
      tasks.push({ id: 'hn', name: 'Hacker News', run: () => src.hnWeek().then((x) => x.slice(0, 8)) });
    }
  }
  const savedIds = new Set(saved.map((e) => e.id));
  const r = await collect(tasks);
  return { ...r, basis, items: shuffleStable(dedupe(r.items).filter((i) => !savedIds.has(i.id))).slice(0, 16) };
}

/** Deterministic per-day shuffle so the rail feels fresh but does not jump on re-render. */
function shuffleStable<T extends { id: string }>(arr: T[]) {
  const seed = new Date().toDateString();
  const h = (s: string) => {
    let x = 0;
    for (const c of seed + s) x = (x * 31 + c.charCodeAt(0)) | 0;
    return x;
  };
  return [...arr].sort((a, b) => h(a.id) - h(b.id));
}

/* ---------- Trending (real popularity data only) ---------- */

export type SectionState = { status: 'ok'; items: ContentItem[] } | { status: 'needsKey'; key: 'tmdb' | 'rawg' } | { status: 'error'; error: string } | { status: 'disabled' };

async function section(enabled: boolean, needs: false | 'tmdb' | 'rawg', fn: () => Promise<ContentItem[]>): Promise<SectionState> {
  if (!enabled) return { status: 'disabled' };
  if (needs) return { status: 'needsKey', key: needs };
  try {
    return { status: 'ok', items: await fn() };
  } catch (e) {
    return { status: 'error', error: describeError(e) };
  }
}

export interface TrendingData {
  movies: SectionState;
  tv: SectionState;
  games: SectionState;
  news: SectionState;
  tech: SectionState;
}

export async function trending(s: Settings): Promise<TrendingData> {
  const [movies, tv, games, news, tech] = await Promise.all([
    section(on(s, 'movies'), hasTmdb(s) ? false : 'tmdb', () => src.tmdbTrending(s, 'movie').then((x) => x.slice(0, 20))),
    section(on(s, 'tv'), hasTmdb(s) ? false : 'tmdb', () => src.tmdbTrending(s, 'tv').then((x) => x.slice(0, 20))),
    section(on(s, 'games'), hasRawg(s) ? false : 'rawg', () => src.rawgTrending(s).then((x) => x.slice(0, 20))),
    section(on(s, 'world'), false, () => src.wiki(s).then((d) => d.mostRead.slice(0, 20))),
    section(on(s, 'tech'), false, () => src.hnFront().then((x) => x.slice(0, 20))),
  ]);
  if ([movies, tv, games, news, tech].every((x) => x.status === 'error')) throw new HttpError('network', 'Trending unavailable');
  return { movies, tv, games, news, tech };
}

/* ---------- Upcoming releases ---------- */

export async function upcoming(s: Settings, days = 120): Promise<FeedResult> {
  const from = ymd(new Date());
  const to = ymd(new Date(Date.now() + days * 864e5));
  const tasks: Task[] = [];
  if (on(s, 'movies') && hasTmdb(s)) {
    tasks.push({ id: 'tmdb-movies', name: 'TMDB', run: () => memo(`tmdb:upcoming:${from}:${days}:${s.region}:${s.language}`, 6 * 60 * MIN, () => tmdb.upcomingMovies(tmdbCfg(s), from, to)) });
  }
  if (on(s, 'tv')) {
    if (hasTmdb(s)) {
      tasks.push({ id: 'tmdb-tv', name: 'TMDB', run: () => memo(`tmdb:tvprem:${from}:${days}:${s.language}`, 6 * 60 * MIN, () => tmdb.tvPremieres(tmdbCfg(s), from, to)) });
    }
    tasks.push({ id: 'tvmaze', name: 'TVmaze', run: () => memo(`tvmaze:premieres:${from}:${s.region}`, 6 * 60 * MIN, () => tvmaze.premieres(10, s.region)) });
  }
  if (on(s, 'games') && hasRawg(s)) {
    tasks.push({ id: 'rawg', name: 'RAWG', run: () => memo(`rawg:upcoming:${from}`, 6 * 60 * MIN, () => rawg.upcoming(s.rawgKey.trim(), undefined, days)) });
  }
  if (!tasks.length) return { items: [], sources: [] };
  const r = await collect(tasks);
  const items = dedupe(r.items)
    .filter((i) => {
      const d = daysUntil(i.date);
      return d !== null && d >= 0 && d <= days;
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return { ...r, items };
}

/* ---------- Discover ---------- */

export async function tvAiring(s: Settings) {
  return memo(`tvmaze:airing:${ymd(new Date())}:${s.region}`, 30 * MIN, () => tvmaze.airingToday(ymd(new Date()), s.region));
}

export const discover = {
  async movies(s: Settings, genre?: number) {
    const cfg = tmdbCfg(s);
    const [popular, nowPlaying, upcomingList, topRated] = await Promise.all([
      memo(`tmdb:popular:${genre ?? 0}:${s.region}:${s.language}`, 60 * MIN, () => tmdb.popularMovies(cfg, genre)),
      memo(`tmdb:nowplaying:${s.region}:${s.language}`, 60 * MIN, () => tmdb.nowPlaying(cfg)),
      memo(`tmdb:upcoming60:${s.region}:${s.language}`, 6 * 60 * MIN, () =>
        tmdb.upcomingMovies(cfg, ymd(new Date(Date.now() + 864e5)), ymd(new Date(Date.now() + 90 * 864e5)))),
      memo(`tmdb:toprated:${s.language}`, 6 * 60 * MIN, () => tmdb.topRatedMovies(cfg)),
    ]);
    return { popular, nowPlaying, upcoming: upcomingList.slice(0, 20), topRated };
  },
  async trailers(s: Settings) {
    const cfg = tmdbCfg(s);
    const pool = (await src.tmdbTrending(s, 'movie')).slice(0, 8);
    const out = await Promise.all(
      pool.map((m) => memo(`tmdb:videos:${m.id}`, 12 * 60 * MIN, () => tmdb.trailersFor(cfg, m).then((t) => t.map((x) => ({ ...x, item: m })))).catch(() => [])),
    );
    return out.map((t) => t[0]).filter(Boolean);
  },
  async tv(s: Settings) {
    const cfg = tmdbCfg(s);
    const [popular, airing, topRated] = await Promise.all([
      memo(`tmdb:populartv:${s.language}`, 60 * MIN, () => tmdb.popularTv(cfg)),
      memo(`tmdb:airing:${s.language}`, 60 * MIN, () => tmdb.airingToday(cfg)),
      memo(`tmdb:topratedtv:${s.language}`, 6 * 60 * MIN, () => tmdb.topRatedTv(cfg)),
    ]);
    return { popular, airing, topRated };
  },
  async games(s: Settings, platform?: number) {
    const key = s.rawgKey.trim();
    const [popular, fresh, soon] = await Promise.all([
      memo(`rawg:popular:${platform ?? 0}`, 60 * MIN, () => rawg.popular(key, platform)),
      memo(`rawg:new:${platform ?? 0}`, 60 * MIN, () => rawg.newReleases(key, platform)),
      memo(`rawg:soon:${platform ?? 0}`, 6 * 60 * MIN, () => rawg.upcoming(key, platform, 365)),
    ]);
    return { popular, fresh, upcoming: [...soon].sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9')) };
  },
  async gameNews(s: Settings) {
    return collect(rssTasks(s, ['games'])).then((r) => ({ ...r, items: dedupe(r.items).sort(byDateDesc) }));
  },
  async entertainmentNews(s: Settings) {
    return collect(rssTasks(s, ['movies', 'tv'])).then((r) => ({ ...r, items: dedupe(r.items).sort(byDateDesc) }));
  },
  async sports(league: string) {
    const [scores, news] = await Promise.allSettled([src.espnScores(league), src.espnNews(league)]);
    if (scores.status === 'rejected' && news.status === 'rejected') throw news.reason;
    return {
      scores: scores.status === 'fulfilled' ? scores.value : null,
      news: news.status === 'fulfilled' ? news.value : null,
    };
  },
  async tech(s: Settings) {
    const r = await collect([
      { id: 'hn', name: 'Hacker News', run: () => src.hnWeek() },
      ...rssTasks(s, ['tech']),
    ]);
    const hn = r.items.filter((i) => i.source === 'hn');
    const news = dedupe(r.items.filter((i) => i.source !== 'hn')).sort(byDateDesc);
    return { hn, news, sources: r.sources };
  },
  async world(s: Settings) {
    const r = await collect([
      { id: 'wikipedia', name: 'Wikipedia', run: async () => { const d = await src.wiki(s); return [...d.inTheNews, ...d.onThisDay, ...[d.featured, d.picture].filter((x): x is ContentItem => !!x)]; } },
      { id: 'spaceflight', name: 'Spaceflight News', run: () => src.space() },
      ...rssTasks(s, ['world']),
    ]);
    const wiki = src.wiki(s).catch(() => null);
    const digest = await wiki;
    const general = dedupe(r.items.filter((i) => i.subcategory === 'general' || (i.source === 'rss' && !i.subcategory))).sort(byDateDesc);
    const science = dedupe(r.items.filter((i) => i.subcategory === 'science')).sort(byDateDesc);
    return { general, science, digest, sources: r.sources };
  },
};

/* ---------- Search ---------- */

export const search = {
  async media(s: Settings, q: string) {
    if (hasTmdb(s)) return memo(`tmdb:search:${q}:${s.language}`, 10 * MIN, () => tmdb.search(tmdbCfg(s), q));
    return memo(`tvmaze:search:${q}`, 10 * MIN, () => tvmaze.search(q));
  },
  async games(s: Settings, q: string) {
    if (!hasRawg(s)) throw new HttpError('config', 'rawg');
    return memo(`rawg:search:${q}`, 10 * MIN, () => rawg.search(s.rawgKey.trim(), q));
  },
  async news(q: string) {
    const ql = q.toLowerCase();
    const tasks: Task[] = [
      { id: 'hn', name: 'Hacker News', run: () => memo(`hn:search:${q}`, 10 * MIN, () => hackerNews.search(q)) },
      { id: 'spaceflight', name: 'Spaceflight News', run: () => memo(`snapi:search:${q}`, 10 * MIN, () => spaceflight.search(q)) },
      {
        // Recently fetched articles (RSS, ESPN, Wikipedia) searched locally.
        id: 'local',
        name: 'Recent articles',
        run: async () => {
          const rows = await db.items.where('at').above(Date.now() - 3 * 864e5).toArray();
          return rows
            .map((r) => r.item)
            .filter((i) => i.kind === 'article' && ['rss', 'espn', 'wikipedia'].includes(i.source))
            .filter((i) => `${i.title} ${i.description ?? ''}`.toLowerCase().includes(ql))
            .slice(0, 20);
        },
      },
    ];
    const r = await collect(tasks);
    return dedupe(r.items).sort(byDateDesc);
  },
};

/* ---------- Details ---------- */

export async function detail(s: Settings, id: string): Promise<DetailResult> {
  const [source, kind, ...rest] = id.split(':');
  const sourceId = rest.join(':');
  const snapshot = async () =>
    (await db.items.get(id))?.item ?? (await db.watchlist.get(id))?.item ?? (await db.recent.get(id))?.item ?? DEMO_ITEMS.find((d) => d.id === id);

  try {
    if (source === 'tmdb' && (kind === 'movie' || kind === 'tv')) {
      if (!hasTmdb(s)) throw new HttpError('config', 'tmdb');
      return await memo(`tmdb:detail:${id}:${s.language}`, 30 * MIN, () => tmdb.details(tmdbCfg(s), kind, sourceId));
    }
    if (source === 'rawg') {
      if (!hasRawg(s)) throw new HttpError('config', 'rawg');
      return await memo(`rawg:detail:${id}`, 30 * MIN, () => rawg.details(s.rawgKey.trim(), sourceId));
    }
    if (source === 'tvmaze') {
      return await memo(`tvmaze:detail:${id}`, 30 * MIN, () => tvmaze.details(sourceId));
    }
  } catch (e) {
    // Fall back to the stored snapshot if we have one (offline, key removed…).
    const snap = await snapshot();
    if (snap) return { item: snap, facts: [], trailers: [], cast: [], gallery: [], related: await relatedLocal(snap), live: false };
    throw e;
  }

  const snap = await snapshot();
  if (!snap) throw new HttpError('http', 'Item not found', 404);
  return { item: snap, facts: [], trailers: [], cast: [], gallery: [], related: await relatedLocal(snap), live: false };
}

async function relatedLocal(item: ContentItem) {
  if (item.isDemo) return DEMO_ITEMS.filter((d) => d.kind === item.kind && d.id !== item.id);
  const rows = await db.items.where('at').above(Date.now() - 3 * 864e5).toArray();
  const words = new Set(item.title.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  return rows
    .map((r) => r.item)
    .filter((i) => i.id !== item.id && i.category === item.category && (!item.subcategory || i.subcategory === item.subcategory || i.image))
    .map((i) => ({ i, score: i.title.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length + (i.image ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score || byDateDesc(a.i, b.i))
    .slice(0, 12)
    .map((x) => x.i);
}
