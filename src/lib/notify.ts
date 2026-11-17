import { db } from './db';
import type { Settings } from './types';

export type NotifySupport = 'supported' | 'unsupported' | 'needs-install';

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/**
 * iOS/iPadOS only expose web notifications (16.4+) to apps added to the Home
 * Screen. Elsewhere the Notification API must simply exist.
 */
export function notificationSupport(): NotifySupport {
  if (!('Notification' in window)) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  return 'supported';
}

export function permission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showNotification(title: string, body: string, url?: string, tag?: string) {
  if (permission() !== 'granted') return false;
  const options: NotificationOptions & { data?: unknown } = {
    body,
    tag,
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    data: { url: url ?? import.meta.env.BASE_URL },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export interface DueReminder {
  id: string;
  title: string;
  body: string;
  url?: string;
}

/**
 * There is no push server, so reminders are checked whenever PULSE is open
 * (and when it returns to the foreground). Due reminders are marked as fired
 * and surfaced both as a system notification (if allowed) and in-app.
 */
export async function checkReminders(settings: Settings, messages: { release: string; saved: (n: number) => string; savedBody: string }) {
  const now = Date.now();
  const due = await db.reminders.where('at').belowOrEqual(now).filter((r) => !r.fired).toArray();
  const out: DueReminder[] = [];
  for (const r of due) {
    await db.reminders.update(r.id, { fired: true });
    // Skip reminders that went stale more than two days ago (app was closed).
    if (now - r.at > 2 * 864e5) continue;
    const url = r.itemId ? `${import.meta.env.BASE_URL}item/${encodeURIComponent(r.itemId)}` : undefined;
    const body = r.type === 'release' ? messages.release : r.note ?? '';
    out.push({ id: r.id, title: r.title, body, url });
    if (settings.notifications.enabled) await showNotification(r.title, body, url, r.id);
  }

  if (settings.notifications.enabled && settings.notifications.savedDigest && now - settings.lastDigestAt > 7 * 864e5) {
    const waiting = await db.watchlist.where('status').notEqual('completed').filter((e) => now - e.addedAt > 7 * 864e5).count();
    if (waiting > 0) {
      const title = messages.saved(waiting);
      out.push({ id: `digest-${now}`, title, body: messages.savedBody, url: `${import.meta.env.BASE_URL}watchlist` });
      await showNotification(title, messages.savedBody, `${import.meta.env.BASE_URL}watchlist`, 'pulse-digest');
    }
    await db.settings.toCollection().modify((row) => {
      row.value = { ...row.value, lastDigestAt: now };
    });
  }
  return out;
}
