import type { Category, RssFeed, Settings } from './types';

export const DEFAULT_RSS_FEEDS: RssFeed[] = [
  { id: 'bbc-world', name: 'BBC News — World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world', subcategory: 'general', enabled: true },
  { id: 'bbc-science', name: 'BBC News — Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'world', subcategory: 'science', enabled: true },
  { id: 'sciencedaily', name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top/science.xml', category: 'world', subcategory: 'science', enabled: true },
  { id: 'bbc-tech', name: 'BBC News — Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech', enabled: true },
  { id: 'verge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', enabled: true },
  { id: 'ars', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', enabled: true },
  { id: 'techcrunch-ai', name: 'TechCrunch — AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'tech', subcategory: 'ai', enabled: true },
  { id: 'gamespot', name: 'GameSpot News', url: 'https://www.gamespot.com/feeds/news/', category: 'games', enabled: true },
  { id: 'variety-film', name: 'Variety — Film', url: 'https://variety.com/v/film/feed/', category: 'movies', enabled: true },
  { id: 'variety-tv', name: 'Variety — TV', url: 'https://variety.com/v/tv/feed/', category: 'tv', enabled: true },
  { id: 'ynet', name: 'ynet — חדשות', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', category: 'world', subcategory: 'general', enabled: false, lang: 'he' },
  { id: 'geektime', name: 'Geektime', url: 'https://www.geektime.co.il/feed/', category: 'tech', enabled: false, lang: 'he' },
];

/**
 * Most publishers do not send CORS headers, so a static site can only read
 * their RSS through a CORS proxy. These are public, free proxies; users can
 * replace them in Settings → Sources. `{url}` is replaced by the encoded feed URL.
 */
export const DEFAULT_RSS_PROXIES = [
  'https://api.allorigins.win/raw?url={url}',
  'https://api.codetabs.com/v1/proxy?quest={url}',
];

export interface League {
  id: string; // ESPN path: sport/league
  name: string;
  sport: 'basketball' | 'soccer' | 'football' | 'other';
}

export const LEAGUES: League[] = [
  { id: 'basketball/nba', name: 'NBA', sport: 'basketball' },
  { id: 'basketball/wnba', name: 'WNBA', sport: 'basketball' },
  { id: 'basketball/mens-college-basketball', name: 'NCAA Basketball', sport: 'basketball' },
  { id: 'soccer/eng.1', name: 'Premier League', sport: 'soccer' },
  { id: 'soccer/uefa.champions', name: 'Champions League', sport: 'soccer' },
  { id: 'soccer/esp.1', name: 'LaLiga', sport: 'soccer' },
  { id: 'soccer/ita.1', name: 'Serie A', sport: 'soccer' },
  { id: 'football/nfl', name: 'NFL', sport: 'football' },
  { id: 'football/college-football', name: 'College Football', sport: 'football' },
  { id: 'baseball/mlb', name: 'MLB', sport: 'other' },
  { id: 'hockey/nhl', name: 'NHL', sport: 'other' },
  { id: 'racing/f1', name: 'Formula 1', sport: 'other' },
];

export const ALL_CATEGORIES: Category[] = ['movies', 'tv', 'games', 'sports', 'tech', 'world'];

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  onboarded: false,
  theme: 'dark',
  accent: 'cyan',
  language: 'en',
  enabledCategories: [...ALL_CATEGORIES],
  favoriteCategories: ['movies', 'tv', 'games', 'tech'],
  contentTypes: ['movie', 'tv', 'game', 'article', 'event'],
  homeSections: {
    quick: true,
    featured: true,
    latest: true,
    trending: true,
    recommended: true,
    upcoming: true,
    recent: true,
  },
  region: 'US',
  tmdbKey: '',
  rawgKey: '',
  rssProxies: [...DEFAULT_RSS_PROXIES],
  rssFeeds: DEFAULT_RSS_FEEDS,
  sportsLeagues: ['basketball/nba', 'soccer/eng.1', 'football/nfl'],
  notifications: {
    enabled: false,
    releaseReminders: true,
    releaseLeadDays: 0,
    savedDigest: false,
  },
  lastDigestAt: 0,
};

export const REGIONS = ['US', 'GB', 'IL', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'IN', 'BR', 'JP'];
