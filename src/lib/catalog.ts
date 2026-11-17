import { Clapperboard, Cpu, Gamepad2, Globe2, Trophy, Tv, type LucideIcon } from 'lucide-react';
import type { Category, ContentKind } from './types';
import type { TKey } from './messages';

export const CATEGORY_META: Record<Category, { icon: LucideIcon; label: TKey; color: string; hue: number }> = {
  movies: { icon: Clapperboard, label: 'cat_movies', color: '#f472b6', hue: 330 },
  tv: { icon: Tv, label: 'cat_tv', color: '#60a5fa', hue: 215 },
  games: { icon: Gamepad2, label: 'cat_games', color: '#a78bfa', hue: 265 },
  sports: { icon: Trophy, label: 'cat_sports', color: '#a3e635', hue: 85 },
  tech: { icon: Cpu, label: 'cat_tech', color: '#22d3ee', hue: 188 },
  world: { icon: Globe2, label: 'cat_world', color: '#fbbf24', hue: 40 },
};

export const KIND_LABEL: Record<ContentKind, TKey> = {
  movie: 'kind_movie',
  tv: 'kind_tv',
  game: 'kind_game',
  article: 'kind_article',
  event: 'kind_event',
};

/** Discover sections (Movies & TV share one screen). */
export const DISCOVER_SECTIONS = [
  { slug: 'movies-tv', categories: ['movies', 'tv'] as Category[], label: 'disc_moviesTv' as TKey, blurb: 'disc_moviesTv_blurb' as TKey, icon: CATEGORY_META.movies.icon, hue: 330 },
  { slug: 'games', categories: ['games'] as Category[], label: 'cat_games' as TKey, blurb: 'disc_games_blurb' as TKey, icon: CATEGORY_META.games.icon, hue: 265 },
  { slug: 'sports', categories: ['sports'] as Category[], label: 'cat_sports' as TKey, blurb: 'disc_sports_blurb' as TKey, icon: CATEGORY_META.sports.icon, hue: 85 },
  { slug: 'tech', categories: ['tech'] as Category[], label: 'cat_tech' as TKey, blurb: 'disc_tech_blurb' as TKey, icon: CATEGORY_META.tech.icon, hue: 188 },
  { slug: 'world', categories: ['world'] as Category[], label: 'cat_world' as TKey, blurb: 'disc_world_blurb' as TKey, icon: CATEGORY_META.world.icon, hue: 40 },
];

export function discoverSlugFor(c: Category) {
  return c === 'movies' || c === 'tv' ? 'movies-tv' : c;
}
