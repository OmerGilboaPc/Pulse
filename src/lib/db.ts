import Dexie, { type Table } from 'dexie';
import type { Category, ContentItem, ContentKind, Settings, WatchStatus } from './types';

export interface WatchEntry {
  id: string;
  item: ContentItem;
  category: Category;
  kind: ContentKind;
  status: WatchStatus;
  note: string;
  collectionIds: string[];
  addedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface SearchEntry {
  query: string;
  at: number;
}

export interface HistoryEntry {
  id: string;
  item: ContentItem;
  at: number;
}

export type ReminderType = 'release' | 'saved' | 'custom';

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  at: number;
  type: ReminderType;
  itemId?: string;
  item?: ContentItem;
  fired: boolean;
  createdAt: number;
}

export interface CacheEntry {
  key: string;
  data: unknown;
  at: number;
}

export interface SettingsRow {
  id: 'prefs';
  value: Partial<Settings>;
}

class PulseDB extends Dexie {
  settings!: Table<SettingsRow, string>;
  watchlist!: Table<WatchEntry, string>;
  collections!: Table<Collection, string>;
  searches!: Table<SearchEntry, string>;
  recent!: Table<HistoryEntry, string>;
  reading!: Table<HistoryEntry, string>;
  reminders!: Table<Reminder, string>;
  cache!: Table<CacheEntry, string>;
  items!: Table<HistoryEntry, string>;

  constructor() {
    super('pulse');
    this.version(1).stores({
      settings: 'id',
      watchlist: 'id, category, kind, status, addedAt, updatedAt, *collectionIds',
      collections: 'id, createdAt',
      searches: 'query, at',
      recent: 'id, at',
      reading: 'id, at',
      reminders: 'id, at, itemId, type',
      cache: 'key, at',
      items: 'id, at',
    });
  }
}

export const db = new PulseDB();

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Snapshot of fetched items so detail pages work for sources without a detail API. */
export async function rememberItems(items: ContentItem[]) {
  if (!items.length) return;
  const at = Date.now();
  try {
    await db.items.bulkPut(items.map((item) => ({ id: item.id, item, at })));
  } catch {
    /* storage can be full or unavailable in private mode — never break the UI for it */
  }
}

/** Housekeeping: drop stale snapshots and API cache entries. */
export async function pruneStorage() {
  const now = Date.now();
  try {
    await db.items.where('at').below(now - 21 * 864e5).delete();
    await db.cache.where('at').below(now - 7 * 864e5).delete();
    const recentCount = await db.recent.count();
    if (recentCount > 60) {
      const old = await db.recent.orderBy('at').limit(recentCount - 60).primaryKeys();
      await db.recent.bulkDelete(old);
    }
    const searchCount = await db.searches.count();
    if (searchCount > 30) {
      const old = await db.searches.orderBy('at').limit(searchCount - 30).primaryKeys();
      await db.searches.bulkDelete(old);
    }
  } catch {
    /* ignore */
  }
}
