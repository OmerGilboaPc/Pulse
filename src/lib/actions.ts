import { db, uid, type Collection, type Reminder, type WatchEntry } from './db';
import type { ContentItem, Settings, WatchStatus } from './types';
import { parseDate } from './format';
import { hashString } from './format';

/* ---------- Settings signature for query keys ---------- */
export function settingsSig(s: Settings) {
  return hashString(
    JSON.stringify([
      s.language,
      s.region,
      s.tmdbKey.trim(),
      s.rawgKey.trim(),
      s.enabledCategories,
      s.favoriteCategories,
      s.rssFeeds.filter((f) => f.enabled).map((f) => f.url),
      s.rssProxies,
      s.sportsLeagues,
    ]),
  ).toString(36);
}

/* ---------- Watchlist ---------- */

/** Strip heavy/volatile fields before storing a snapshot. */
function snapshot(item: ContentItem): ContentItem {
  const { ...rest } = item;
  return rest;
}

export async function saveItem(item: ContentItem, settings?: Settings) {
  const now = Date.now();
  const existing = await db.watchlist.get(item.id);
  if (existing) return existing;
  const entry: WatchEntry = {
    id: item.id,
    item: snapshot(item),
    category: item.category,
    kind: item.kind,
    status: 'planned',
    note: '',
    collectionIds: [],
    addedAt: now,
    updatedAt: now,
  };
  await db.watchlist.put(entry);
  if (settings?.notifications.enabled && settings.notifications.releaseReminders) {
    await ensureReleaseReminder(item, settings.notifications.releaseLeadDays);
  }
  return entry;
}

export async function removeItem(id: string) {
  const entry = await db.watchlist.get(id);
  await db.watchlist.delete(id);
  await db.reminders.where('itemId').equals(id).filter((r) => r.type === 'release' && !r.fired).delete();
  return entry;
}

export async function restoreEntry(entry: WatchEntry) {
  await db.watchlist.put(entry);
}

export async function setStatus(id: string, status: WatchStatus) {
  await db.watchlist.update(id, { status, updatedAt: Date.now(), completedAt: status === 'completed' ? Date.now() : undefined });
}

export async function setNote(id: string, note: string) {
  await db.watchlist.update(id, { note: note.slice(0, 1000), updatedAt: Date.now() });
}

export async function toggleCollection(id: string, collectionId: string) {
  const e = await db.watchlist.get(id);
  if (!e) return;
  const has = e.collectionIds.includes(collectionId);
  await db.watchlist.update(id, {
    collectionIds: has ? e.collectionIds.filter((c) => c !== collectionId) : [...e.collectionIds, collectionId],
    updatedAt: Date.now(),
  });
}

export const COLLECTION_COLORS = ['#22d3ee', '#2dd4bf', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa', '#34d399', '#fb7185'];

export type CollectionError = 'required' | 'tooLong' | 'duplicate';

export async function validateCollectionName(name: string, ignoreId?: string): Promise<CollectionError | null> {
  const n = name.trim();
  if (!n) return 'required';
  if (n.length > 40) return 'tooLong';
  const all = await db.collections.toArray();
  if (all.some((c) => c.id !== ignoreId && c.name.toLowerCase() === n.toLowerCase())) return 'duplicate';
  return null;
}

export async function createCollection(name: string, color?: string): Promise<Collection> {
  const count = await db.collections.count();
  const c: Collection = { id: uid(), name: name.trim(), color: color ?? COLLECTION_COLORS[count % COLLECTION_COLORS.length], createdAt: Date.now() };
  await db.collections.put(c);
  return c;
}

export async function renameCollection(id: string, name: string) {
  await db.collections.update(id, { name: name.trim() });
}

export async function deleteCollection(id: string) {
  await db.transaction('rw', db.collections, db.watchlist, async () => {
    await db.collections.delete(id);
    const entries = await db.watchlist.where('collectionIds').equals(id).toArray();
    for (const e of entries) await db.watchlist.update(e.id, { collectionIds: e.collectionIds.filter((c) => c !== id) });
  });
}

/* ---------- History ---------- */

export async function recordView(item: ContentItem) {
  try {
    await db.recent.put({ id: item.id, item: snapshot(item), at: Date.now() });
  } catch {
    /* ignore */
  }
}

export async function recordRead(item: ContentItem) {
  try {
    await db.reading.put({ id: item.id, item: snapshot(item), at: Date.now() });
  } catch {
    /* ignore */
  }
}

export async function recordSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  await db.searches.put({ query: q, at: Date.now() });
}

/* ---------- Reminders ---------- */

/** Release reminders fire at 09:00 local time, `leadDays` before release. */
export function releaseReminderTime(date: string | undefined, leadDays: number) {
  const d = parseDate(date);
  if (!d) return null;
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate() - leadDays, 9, 0, 0);
  return at.getTime();
}

export async function ensureReleaseReminder(item: ContentItem, leadDays: number) {
  const at = releaseReminderTime(item.date, leadDays);
  if (!at || at <= Date.now()) return null;
  const existing = await db.reminders.where('itemId').equals(item.id).filter((r) => r.type === 'release').first();
  if (existing) return existing;
  const r: Reminder = {
    id: uid(),
    title: item.title,
    at,
    type: 'release',
    itemId: item.id,
    item: snapshot(item),
    fired: false,
    createdAt: Date.now(),
  };
  await db.reminders.put(r);
  return r;
}

export type ReminderError = 'titleRequired' | 'titleTooLong' | 'dateRequired' | 'dateInPast' | 'noteTooLong';

export function validateReminder(title: string, at: number | null, note = ''): ReminderError | null {
  if (!title.trim()) return 'titleRequired';
  if (title.trim().length > 80) return 'titleTooLong';
  if (!at || Number.isNaN(at)) return 'dateRequired';
  if (at <= Date.now() + 30_000) return 'dateInPast';
  if (note.length > 300) return 'noteTooLong';
  return null;
}

export async function createReminder(input: { title: string; at: number; note?: string; item?: ContentItem; type?: Reminder['type'] }) {
  const r: Reminder = {
    id: uid(),
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    at: input.at,
    type: input.type ?? 'custom',
    itemId: input.item?.id,
    item: input.item ? snapshot(input.item) : undefined,
    fired: false,
    createdAt: Date.now(),
  };
  await db.reminders.put(r);
  return r;
}

export async function deleteReminder(id: string) {
  await db.reminders.delete(id);
}

/* ---------- Calendar export (.ics) ---------- */

function icsDate(ts: number) {
  return new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function buildIcs(events: { uid: string; title: string; start: number; allDay?: boolean; description?: string; url?: string }[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PULSE//Your World. One Feed.//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@pulse`, `DTSTAMP:${icsDate(Date.now())}`);
    if (e.allDay) {
      const d = new Date(e.start);
      const p = (n: number) => String(n).padStart(2, '0');
      const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const nextDay = `${next.getFullYear()}${p(next.getMonth() + 1)}${p(next.getDate())}`;
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay}`);
    } else {
      lines.push(`DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.start + 30 * 60_000)}`);
    }
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(s: string) {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pulse';
}
