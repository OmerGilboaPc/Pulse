import { db, type Collection, type HistoryEntry, type Reminder, type SearchEntry, type SettingsRow, type WatchEntry } from './db';

export interface Backup {
  app: 'pulse';
  version: 1;
  exportedAt: string;
  data: {
    settings: SettingsRow[];
    watchlist: WatchEntry[];
    collections: Collection[];
    searches: SearchEntry[];
    recent: HistoryEntry[];
    reading: HistoryEntry[];
    reminders: Reminder[];
  };
}

export async function exportData(includeKeys: boolean): Promise<Backup> {
  const [settings, watchlist, collections, searches, recent, reading, reminders] = await Promise.all([
    db.settings.toArray(),
    db.watchlist.toArray(),
    db.collections.toArray(),
    db.searches.toArray(),
    db.recent.toArray(),
    db.reading.toArray(),
    db.reminders.toArray(),
  ]);
  const cleanSettings = settings.map((r) =>
    includeKeys ? r : { ...r, value: { ...r.value, tmdbKey: '', rawgKey: '' } },
  );
  return {
    app: 'pulse',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { settings: cleanSettings, watchlist, collections, searches, recent, reading, reminders },
  };
}

export type ImportError = 'invalidJson' | 'notPulse' | 'unsupportedVersion' | 'invalidData';

const isArr = (x: unknown): x is unknown[] => Array.isArray(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: ImportError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalidJson' };
  }
  if (!isObj(raw) || raw.app !== 'pulse') return { ok: false, error: 'notPulse' };
  if (raw.version !== 1) return { ok: false, error: 'unsupportedVersion' };
  const d = raw.data;
  if (!isObj(d)) return { ok: false, error: 'invalidData' };
  const tables = ['settings', 'watchlist', 'collections', 'searches', 'recent', 'reading', 'reminders'];
  for (const t of tables) if (d[t] !== undefined && !isArr(d[t])) return { ok: false, error: 'invalidData' };
  const wl = (d.watchlist ?? []) as unknown[];
  if (!wl.every((e) => isObj(e) && typeof e.id === 'string' && isObj(e.item) && typeof (e.item as Record<string, unknown>).title === 'string')) {
    return { ok: false, error: 'invalidData' };
  }
  const cols = (d.collections ?? []) as unknown[];
  if (!cols.every((c) => isObj(c) && typeof c.id === 'string' && typeof c.name === 'string')) return { ok: false, error: 'invalidData' };
  const rem = (d.reminders ?? []) as unknown[];
  if (!rem.every((r) => isObj(r) && typeof r.id === 'string' && typeof r.at === 'number' && typeof r.title === 'string')) {
    return { ok: false, error: 'invalidData' };
  }
  return { ok: true, backup: raw as unknown as Backup };
}

export function backupSummary(b: Backup) {
  return {
    watchlist: b.data.watchlist?.length ?? 0,
    collections: b.data.collections?.length ?? 0,
    reminders: b.data.reminders?.length ?? 0,
    history: (b.data.recent?.length ?? 0) + (b.data.reading?.length ?? 0),
  };
}

export async function importData(b: Backup, mode: 'merge' | 'replace') {
  const d = b.data;
  await db.transaction('rw', [db.settings, db.watchlist, db.collections, db.searches, db.recent, db.reading, db.reminders], async () => {
    if (mode === 'replace') {
      await Promise.all([db.watchlist.clear(), db.collections.clear(), db.searches.clear(), db.recent.clear(), db.reading.clear(), db.reminders.clear()]);
    }
    if (d.settings?.length) {
      const current = (await db.settings.get('prefs'))?.value ?? {};
      const incoming = d.settings[0].value ?? {};
      // Never wipe locally stored API keys with blanks from a key-less export.
      const merged = {
        ...(mode === 'merge' ? current : {}),
        ...incoming,
        tmdbKey: incoming.tmdbKey || current.tmdbKey || '',
        rawgKey: incoming.rawgKey || current.rawgKey || '',
        onboarded: true,
      };
      await db.settings.put({ id: 'prefs', value: merged });
    }
    if (d.watchlist?.length) await db.watchlist.bulkPut(d.watchlist.map((e) => ({ ...e, note: e.note ?? '', collectionIds: e.collectionIds ?? [], status: e.status ?? 'planned' })));
    if (d.collections?.length) await db.collections.bulkPut(d.collections);
    if (d.searches?.length) await db.searches.bulkPut(d.searches);
    if (d.recent?.length) await db.recent.bulkPut(d.recent);
    if (d.reading?.length) await db.reading.bulkPut(d.reading);
    if (d.reminders?.length) await db.reminders.bulkPut(d.reminders);
  });
}

export async function resetAll() {
  await db.delete();
  try {
    localStorage.removeItem('pulse:boot');
  } catch {
    /* ignore */
  }
}
