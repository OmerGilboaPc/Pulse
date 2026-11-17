import type { ContentItem } from '../lib/types';

/**
 * Sample entries shown only when TMDB / RAWG are not connected, so the
 * browsing screens can be explored. Titles are fictional, have no images and
 * are always rendered with a "Sample" badge — never presented as real data.
 */
const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const movie = (n: number, title: string, genres: string[], description: string, offset: number): ContentItem => ({
  id: `demo:movie:${n}`,
  source: 'demo',
  kind: 'movie',
  category: 'movies',
  title,
  description,
  genres,
  date: day(offset),
  sourceName: 'PULSE sample',
  isDemo: true,
});

const game = (n: number, title: string, genres: string[], platforms: string[], description: string, offset: number): ContentItem => ({
  id: `demo:game:${n}`,
  source: 'demo',
  kind: 'game',
  category: 'games',
  title,
  description,
  genres,
  platforms,
  date: day(offset),
  sourceName: 'PULSE sample',
  isDemo: true,
});

export const DEMO_MOVIES: ContentItem[] = [
  movie(1, 'Signal Over Kepler', ['Science Fiction', 'Drama'], 'A deep-space relay crew decodes a message that arrives forty years too early.', 12),
  movie(2, 'The Glass Harbor', ['Thriller'], 'A harbor pilot uncovers a smuggling route hidden inside the city’s new sea wall.', -20),
  movie(3, 'Midnight Cartography', ['Adventure', 'Fantasy'], 'Two siblings inherit a map that redraws itself every night.', 34),
  movie(4, 'Static Bloom', ['Romance', 'Music'], 'A radio host and a session violinist fall for each other across a summer of broadcasts.', -60),
  movie(5, 'Ninefold', ['Action'], 'An elite courier has nine hours to cross a city that has sealed every bridge.', 55),
  movie(6, 'Paper Satellites', ['Animation', 'Family'], 'A young inventor builds a satellite out of school homework — and it works.', -5),
];

export const DEMO_GAMES: ContentItem[] = [
  game(1, 'Neon Drift: Overclock', ['Racing'], ['PC', 'PlayStation', 'Xbox'], 'Anti-gravity racing across a skyline that rebuilds itself every lap.', 40),
  game(2, 'Hollow Lantern', ['Adventure', 'Indie'], ['PC', 'Nintendo'], 'A hand-drawn exploration game about a lighthouse keeper and a sea of fog.', -30),
  game(3, 'Starforge Tactics', ['Strategy'], ['PC'], 'Turn-based fleet command with a fully simulated economy.', 90),
  game(4, 'Echo Protocol', ['Shooter'], ['PlayStation', 'Xbox'], 'Squad-based infiltration where every sound you make is a clue for the enemy.', -12),
  game(5, 'Tiny Orchard', ['Simulation', 'Casual'], ['Nintendo', 'iOS', 'Android'], 'Grow a pocket-sized orchard that changes with real-world seasons.', 18),
  game(6, 'Rift Wardens', ['RPG', 'Action'], ['PC', 'PlayStation'], 'Co-op action RPG set between collapsing parallel worlds.', 150),
];

export const DEMO_ITEMS = [...DEMO_MOVIES, ...DEMO_GAMES];
