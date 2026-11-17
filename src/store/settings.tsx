import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import type { Settings } from '../lib/types';
import { messages, type TKey } from '../lib/messages';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<void>;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  /** For keys built at runtime (e.g. `fact_${label}`); falls back to `fallback`. */
  tx: (key: string, fallback?: string) => string;
}

const SettingsContext = createContext<Ctx | null>(null);

export function mergeSettings(stored?: Partial<Settings> | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) } as Settings;
  s.homeSections = { ...DEFAULT_SETTINGS.homeSections, ...(stored?.homeSections ?? {}) };
  s.notifications = { ...DEFAULT_SETTINGS.notifications, ...(stored?.notifications ?? {}) };
  return s;
}

function format(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function applyDocument(s: Settings) {
  const d = document.documentElement;
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const light = s.theme === 'light' || (s.theme === 'system' && prefersLight);
  d.classList.toggle('light', light);
  d.dataset.accent = s.accent;
  d.lang = s.language;
  d.dir = s.language === 'he' ? 'rtl' : 'ltr';
  const color = light ? '#f4f6f9' : '#05070a';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
  try {
    localStorage.setItem('pulse:boot', JSON.stringify({ theme: s.theme, accent: s.accent, language: s.language }));
  } catch {
    /* private mode */
  }
}

export function SettingsProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const row = useLiveQuery(async () => (await db.settings.get('prefs')) ?? null, []);
  const settings = useMemo(() => mergeSettings(row?.value), [row]);

  useEffect(() => {
    if (row === undefined) return;
    applyDocument(settings);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const fn = () => applyDocument(settings);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, [settings, row]);

  const update = useCallback<Ctx['update']>(async (patch) => {
    await db.transaction('rw', db.settings, async () => {
      const current = mergeSettings((await db.settings.get('prefs'))?.value);
      const p = typeof patch === 'function' ? patch(current) : patch;
      await db.settings.put({ id: 'prefs', value: { ...current, ...p } });
    });
  }, []);

  const t = useCallback<Ctx['t']>(
    (key, vars) => format(messages[settings.language][key] ?? messages.en[key] ?? key, vars),
    [settings.language],
  );
  const tx = useCallback<Ctx['tx']>(
    (key, fallback) => {
      const dict = messages[settings.language] as Record<string, string>;
      return dict[key] ?? (messages.en as Record<string, string>)[key] ?? fallback ?? key;
    },
    [settings.language],
  );

  const value = useMemo(() => ({ settings, update, t, tx }), [settings, update, t, tx]);
  if (row === undefined) return <>{fallback}</>;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

export const useT = () => useSettings().t;
