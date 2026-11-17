import type { Category, ContentItem, Language, RssFeed } from '../lib/types';
import { hashString, hostnameOf, stripHtml, truncate } from '../lib/format';
import { fetchJson, fetchText, HttpError, mapLimit, qs } from './http';

/* ------------------------------------------------------------------ */
/* Wikipedia — featured feed (most read, in the news, on this day)     */
/* ------------------------------------------------------------------ */

interface WikiPage {
  title: string;
  normalizedtitle?: string;
  titles?: { canonical: string; normalized: string; display?: string };
  description?: string;
  extract?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
  content_urls?: { desktop?: { page: string }; mobile?: { page: string } };
  views?: number;
  rank?: number;
  timestamp?: string;
}

interface WikiFeatured {
  tfa?: WikiPage;
  mostread?: { date: string; articles: WikiPage[] };
  news?: { story: string; links: WikiPage[] }[];
  onthisday?: { text: string; year: number; pages: WikiPage[] }[];
  image?: {
    title: string;
    thumbnail?: { source: string };
    image?: { source: string };
    description?: { text?: string };
    file_page?: string;
    artist?: { text?: string };
  };
}

export interface WikiDigest {
  featured?: ContentItem;
  picture?: ContentItem;
  mostRead: ContentItem[];
  inTheNews: ContentItem[];
  onThisDay: ContentItem[];
  date: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function wikiItem(p: WikiPage, lang: Language, sub: string, extra: Partial<ContentItem> = {}): ContentItem {
  const canonical = p.titles?.canonical ?? p.title;
  return {
    id: `wikipedia:article:${lang}:${canonical}`,
    source: 'wikipedia',
    kind: 'article',
    category: 'world',
    subcategory: sub,
    title: p.titles?.normalized ?? p.normalizedtitle ?? p.title.replace(/_/g, ' '),
    description: p.extract || p.description,
    image: p.originalimage?.source ?? p.thumbnail?.source,
    url: p.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(canonical)}`,
    sourceName: 'Wikipedia',
    ...extra,
  };
}

export async function wikipediaDigest(lang: Language): Promise<WikiDigest> {
  // The feed for "today" can be empty early in the UTC day — fall back to yesterday.
  let data: WikiFeatured | null = null;
  let usedDate = '';
  let lastError: unknown = null;
  for (const offset of [0, -1]) {
    const d = new Date(Date.now() + offset * 864e5);
    const path = `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
    try {
      data = await fetchJson<WikiFeatured>(`https://${lang}.wikipedia.org/api/rest_v1/feed/featured/${path}`);
      usedDate = d.toISOString().slice(0, 10);
      if (data.mostread?.articles?.length || data.tfa || data.news?.length) break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data) throw lastError ?? new HttpError('network', 'Wikipedia unavailable');

  const skip = /^(Special|Wikipedia|File|Portal|Main_Page|ויקיפדיה|מיוחד|קובץ|עמוד_ראשי)/;
  const mostReadDate = data.mostread?.date;
  const mostRead = (data.mostread?.articles ?? [])
    .filter((a) => !skip.test(a.title))
    .slice(0, 30)
    .map((a) =>
      wikiItem(a, lang, 'mostread', {
        date: mostReadDate,
        popularity: a.views ? { value: a.views, metric: 'wikiViews' } : undefined,
      }),
    );

  const inTheNews = (data.news ?? []).map((n, i) => {
    const lead = n.links.find((l) => l.thumbnail) ?? n.links[0];
    const story = stripHtml(n.story);
    const base = lead ? wikiItem(lead, lang, 'news') : null;
    return {
      ...(base ?? { source: 'wikipedia' as const, kind: 'article' as const, category: 'world' as const, sourceName: 'Wikipedia' }),
      id: `wikipedia:article:${lang}:news-${usedDate}-${hashString(story)}`,
      title: story,
      description: lead?.extract,
      subcategory: 'general',
      date: usedDate,
      sourceName: 'Wikipedia · In the news',
      meta: { order: i },
    } as ContentItem;
  });

  const onThisDay = (data.onthisday ?? []).slice(0, 20).map((e) => {
    const lead = e.pages.find((p) => p.thumbnail) ?? e.pages[0];
    const base = lead ? wikiItem(lead, lang, 'discoveries') : null;
    return {
      ...(base ?? { source: 'wikipedia' as const, kind: 'article' as const, category: 'world' as const, sourceName: 'Wikipedia' }),
      id: `wikipedia:article:${lang}:otd-${e.year}-${hashString(e.text)}`,
      title: e.text,
      subtitle: String(e.year),
      description: lead?.extract,
      subcategory: 'discoveries',
      sourceName: 'Wikipedia · On this day',
      meta: { year: e.year },
    } as ContentItem;
  });

  const featured = data.tfa
    ? wikiItem(data.tfa, lang, 'discoveries', { sourceName: 'Wikipedia · Featured article', date: usedDate })
    : undefined;

  const picture = data.image
    ? ({
        id: `wikipedia:article:${lang}:potd-${usedDate}`,
        source: 'wikipedia',
        kind: 'article',
        category: 'world',
        subcategory: 'discoveries',
        title: stripHtml(data.image.description?.text) || data.image.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        description: data.image.artist?.text ? `© ${stripHtml(data.image.artist.text)}` : undefined,
        image: data.image.image?.source ?? data.image.thumbnail?.source,
        url: data.image.file_page,
        date: usedDate,
        sourceName: 'Wikimedia Commons · Picture of the day',
      } satisfies ContentItem)
    : undefined;

  return { featured, picture, mostRead, inTheNews, onThisDay, date: usedDate };
}

/* ------------------------------------------------------------------ */
/* Hacker News (Algolia) — real points & comments                      */
/* ------------------------------------------------------------------ */

interface HnHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string | null;
  points?: number;
  num_comments?: number;
  author?: string;
  created_at: string;
}

function mapHn(h: HnHit): ContentItem {
  const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
  const host = hostnameOf(h.url ?? undefined);
  return {
    id: `hn:article:${h.objectID}`,
    source: 'hn',
    kind: 'article',
    category: 'tech',
    subcategory: classifyTech(h.title ?? ''),
    title: h.title ?? h.story_title ?? 'Untitled',
    url: h.url || discussion,
    date: h.created_at,
    sourceName: host ? `${host} · via Hacker News` : 'Hacker News',
    popularity: typeof h.points === 'number' ? { value: h.points, metric: 'hnPoints' } : undefined,
    meta: { comments: h.num_comments, discussion, author: h.author },
  };
}

const HN = 'https://hn.algolia.com/api/v1';

export const hackerNews = {
  async frontPage() {
    const r = await fetchJson<{ hits: HnHit[] }>(`${HN}/search?tags=front_page&hitsPerPage=40`);
    return r.hits.map(mapHn).sort((a, b) => (b.popularity?.value ?? 0) - (a.popularity?.value ?? 0));
  },
  async week() {
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;
    const r = await fetchJson<{ hits: HnHit[] }>(
      `${HN}/search?${qs({ tags: 'story', numericFilters: `created_at_i>${since},points>120`, hitsPerPage: 80 })}`,
    );
    return r.hits.map(mapHn).sort((a, b) => (b.popularity?.value ?? 0) - (a.popularity?.value ?? 0));
  },
  async search(query: string) {
    const r = await fetchJson<{ hits: HnHit[] }>(`${HN}/search?${qs({ query, tags: 'story', hitsPerPage: 20 })}`);
    return r.hits.filter((h) => h.title).map(mapHn);
  },
};

/** Lightweight keyword classifier for technology sub-topics. */
const TECH_TOPICS: [string, RegExp][] = [
  ['ai', /\b(ai|a\.i\.|llms?|gpt|openai|anthropic|claude|gemini|chatgpt|machine learning|neural|deepmind|copilot|agents?|diffusion|transformer|inference|mistral|llama)\b|בינה מלאכותית/i],
  ['gadgets', /\b(iphone|ipad|pixel|galaxy|android phone|smartphone|laptop|macbook|headphones?|earbuds|airpods|watch|wearable|camera|tablet|console|vr headset|vision pro|quest|gadget|tv|monitor|keyboard|chip|cpu|gpu|nvidia|amd|intel|snapdragon)\b|סמארטפון|גאדג/i],
  ['software', /\b(software|open[- ]source|linux|windows|macos|ios \d|android \d|rust|python|javascript|typescript|github|programming|developer|release|database|postgres|framework|browser|chrome|firefox|kernel|app|api|cloud|kubernetes|security|vulnerability|bug)\b|תוכנה|אפליקציה/i],
  ['innovation', /\b(startup|research|breakthrough|quantum|robot(s|ics)?|battery|fusion|space|rocket|ev|electric vehicle|self-driving|autonomous|biotech|crispr|semiconductor|energy|solar|drone|innovation|invent)\w*|חדשנות|סטארט/i],
];

export function classifyTech(text: string): string {
  for (const [topic, re] of TECH_TOPICS) if (re.test(text)) return topic;
  return 'general';
}

/* ------------------------------------------------------------------ */
/* Spaceflight News — science & space                                  */
/* ------------------------------------------------------------------ */

interface SnapiArticle {
  id: number;
  title: string;
  url: string;
  image_url?: string;
  news_site?: string;
  summary?: string;
  published_at: string;
}

function mapSnapi(a: SnapiArticle): ContentItem {
  return {
    id: `spaceflight:article:${a.id}`,
    source: 'spaceflight',
    kind: 'article',
    category: 'world',
    subcategory: 'science',
    title: a.title,
    description: a.summary || undefined,
    image: a.image_url || undefined,
    url: a.url,
    date: a.published_at,
    sourceName: a.news_site ? `${a.news_site} · Spaceflight News` : 'Spaceflight News',
  };
}

export const spaceflight = {
  async latest() {
    const r = await fetchJson<{ results: SnapiArticle[] }>('https://api.spaceflightnewsapi.net/v4/articles/?limit=24&ordering=-published_at');
    return r.results.map(mapSnapi);
  },
  async search(query: string) {
    const r = await fetchJson<{ results: SnapiArticle[] }>(
      `https://api.spaceflightnewsapi.net/v4/articles/?${qs({ limit: 12, search: query })}`,
    );
    return r.results.map(mapSnapi);
  },
};

/* ------------------------------------------------------------------ */
/* ESPN public site API — headlines & scoreboards                      */
/* ------------------------------------------------------------------ */

interface EspnArticle {
  id?: number;
  headline: string;
  description?: string;
  published?: string;
  images?: { url: string }[];
  links?: { web?: { href?: string } };
}

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  winner?: boolean;
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
  athlete?: { displayName?: string };
}

interface EspnEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status?: { type?: { state?: 'pre' | 'in' | 'post'; shortDetail?: string; completed?: boolean } };
  competitions?: { competitors?: EspnCompetitor[]; venue?: { fullName?: string } }[];
  links?: { href: string }[];
}

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';

export const espn = {
  async news(league: string, leagueName: string, sport: string): Promise<ContentItem[]> {
    const r = await fetchJson<{ articles: EspnArticle[] }>(`${ESPN}/${league}/news?limit=20`);
    return (r.articles ?? [])
      .filter((a) => a.headline)
      .map((a) => ({
        id: `espn:article:${a.id ?? hashString(a.headline)}`,
        source: 'espn',
        kind: 'article',
        category: 'sports',
        subcategory: sport,
        title: a.headline,
        description: a.description,
        image: a.images?.[0]?.url,
        url: a.links?.web?.href,
        date: a.published,
        sourceName: `ESPN · ${leagueName}`,
        meta: { league },
      }));
  },
  async scoreboard(league: string, leagueName: string, sport: string): Promise<ContentItem[]> {
    const r = await fetchJson<{ events?: EspnEvent[] }>(`${ESPN}/${league}/scoreboard`);
    return (r.events ?? []).map((e) => {
      const comps = e.competitions?.[0]?.competitors ?? [];
      const home = comps.find((c) => c.homeAway === 'home') ?? comps[0];
      const away = comps.find((c) => c.homeAway === 'away') ?? comps[1];
      const nameOf = (c?: EspnCompetitor) => c?.team?.shortDisplayName ?? c?.team?.displayName ?? c?.athlete?.displayName ?? '';
      return {
        id: `espn:event:${e.id}`,
        source: 'espn',
        kind: 'event',
        category: 'sports',
        subcategory: sport,
        title: e.name,
        subtitle: e.shortName,
        date: e.date,
        url: e.links?.[0]?.href,
        sourceName: `ESPN · ${leagueName}`,
        meta: {
          league,
          leagueName,
          state: e.status?.type?.state,
          status: e.status?.type?.shortDetail,
          home: nameOf(home),
          away: nameOf(away),
          homeScore: home?.score,
          awayScore: away?.score,
          homeLogo: home?.team?.logo,
          awayLogo: away?.team?.logo,
          venue: e.competitions?.[0]?.venue?.fullName,
        },
      } satisfies ContentItem;
    });
  },
};

/* ------------------------------------------------------------------ */
/* RSS / Atom                                                          */
/* ------------------------------------------------------------------ */

function textOf(el: Element | null | undefined) {
  return el?.textContent?.trim() ?? '';
}

function firstByTag(parent: Element, names: string[]): Element | null {
  for (const n of names) {
    const found = parent.getElementsByTagName(n);
    if (found.length) return found[0];
  }
  return null;
}

function imageFrom(entry: Element, html: string): string | undefined {
  const media = entry.getElementsByTagName('media:content');
  for (const m of Array.from(media)) {
    const url = m.getAttribute('url');
    const medium = m.getAttribute('medium');
    const type = m.getAttribute('type') ?? '';
    if (url && (medium === 'image' || type.startsWith('image') || /\.(jpe?g|png|webp|gif)/i.test(url))) return url;
  }
  const thumb = entry.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url');
  if (thumb) return thumb;
  const enclosure = Array.from(entry.getElementsByTagName('enclosure')).find((e) => (e.getAttribute('type') ?? '').startsWith('image'));
  if (enclosure?.getAttribute('url')) return enclosure.getAttribute('url')!;
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (img) return img[1].replace(/&amp;/g, '&');
  return undefined;
}

export function parseFeed(xml: string, feed: RssFeed): ContentItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new HttpError('parse', 'Feed is not valid XML');
  const isAtom = doc.documentElement.nodeName === 'feed';
  const entries = Array.from(doc.getElementsByTagName(isAtom ? 'entry' : 'item'));
  if (!entries.length && !doc.getElementsByTagName('channel').length && !isAtom) {
    throw new HttpError('parse', 'Not an RSS or Atom feed');
  }
  return entries.slice(0, 30).map((entry) => {
    const title = stripHtml(textOf(firstByTag(entry, ['title'])));
    let link = '';
    if (isAtom) {
      const links = Array.from(entry.getElementsByTagName('link'));
      link = (links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0])?.getAttribute('href') ?? '';
    } else {
      link = textOf(firstByTag(entry, ['link'])) || textOf(firstByTag(entry, ['guid']));
    }
    const rawHtml = textOf(firstByTag(entry, ['content:encoded', 'content', 'description', 'summary']));
    const desc = stripHtml(textOf(firstByTag(entry, ['description', 'summary'])) || rawHtml);
    const dateStr = textOf(firstByTag(entry, ['pubDate', 'published', 'updated', 'dc:date']));
    const date = dateStr && !Number.isNaN(Date.parse(dateStr)) ? new Date(dateStr).toISOString() : undefined;
    const guid = textOf(firstByTag(entry, ['guid', 'id'])) || link || title;
    const category: Category = feed.category;
    const sub = feed.category === 'tech' ? feed.subcategory ?? classifyTech(`${title} ${desc}`) : feed.subcategory;
    return {
      id: `rss:article:${feed.id}-${hashString(guid)}`,
      source: 'rss',
      kind: 'article',
      category,
      subcategory: sub,
      title: title || hostnameOf(link) || feed.name,
      description: truncate(desc, 400) || undefined,
      image: imageFrom(entry, rawHtml),
      url: link || undefined,
      date,
      sourceName: feed.name,
    } satisfies ContentItem;
  });
}

export async function fetchFeed(feed: RssFeed, proxies: string[]): Promise<ContentItem[]> {
  const attempts = proxies.length ? proxies : ['{url}'];
  let lastError: unknown = null;
  for (const p of attempts) {
    const url = p.includes('{url}') ? p.replace('{url}', encodeURIComponent(feed.url)) : `${p}${encodeURIComponent(feed.url)}`;
    try {
      const xml = await fetchText(p === '{url}' ? feed.url : url, undefined, 10000);
      return parseFeed(xml, feed);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new HttpError('network', 'Feed unavailable');
}

export async function fetchFeeds(feeds: RssFeed[], proxies: string[]) {
  const results = await mapLimit(feeds, 4, (f) => fetchFeed(f, proxies));
  return feeds.map((feed, i) => ({ feed, result: results[i] }));
}
