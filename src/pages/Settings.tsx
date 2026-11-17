import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CircleAlert, CircleCheck, Download, Eye, EyeOff, Globe2, KeyRound, Loader2, Monitor, Moon, Plus, RotateCcw, Rss, Share, ShieldAlert, SquarePlus, Sun, Trash2, Upload } from 'lucide-react';
import { db } from '../lib/db';
import { useSettings } from '../store/settings';
import { invalidateQueries } from '../hooks/useQuery';
import { ALL_CATEGORIES, DEFAULT_RSS_FEEDS, DEFAULT_RSS_PROXIES, LEAGUES, REGIONS } from '../lib/defaults';
import { CATEGORY_META, KIND_LABEL } from '../lib/catalog';
import type { Accent, Category, ContentKind, HomeSection, RssFeed, ThemeMode } from '../lib/types';
import { KINDS } from '../lib/types';
import { tmdb } from '../services/tmdb';
import { rawg } from '../services/rawg';
import { fetchFeed } from '../services/news';
import { isHttpError } from '../services/http';
import { backupSummary, exportData, importData, parseBackup, resetAll, type Backup, type ImportError } from '../lib/backup';
import { downloadFile } from '../lib/actions';
import { isIOS, isStandalone } from '../lib/notify';
import { relativeTime } from '../lib/format';
import { PageHeader } from '../components/layout/Shell';
import { CompactRow } from '../components/content/Cards';
import { ConfirmSheet, Sheet, useToast } from '../components/ui/overlays';
import { Button, Card, Chip, cx, EmptyState, FieldError, Segmented, Toggle } from '../components/ui/primitives';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import type { TKey } from '../lib/messages';

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-2 label-xs text-faint">{title}</h2>
      {children}
      {hint && <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{hint}</p>}
    </section>
  );
}

const ACCENTS: { id: Accent; color: string }[] = [
  { id: 'cyan', color: '#22d3ee' },
  { id: 'turquoise', color: '#2dd4bf' },
  { id: 'blue', color: '#60a5fa' },
  { id: 'violet', color: '#a78bfa' },
  { id: 'rose', color: '#fb7185' },
  { id: 'amber', color: '#fbbf24' },
];

const SECTIONS: { id: HomeSection; label: TKey }[] = [
  { id: 'quick', label: 'home_quick' },
  { id: 'featured', label: 'home_featured' },
  { id: 'trending', label: 'home_trending' },
  { id: 'upcoming', label: 'home_upcoming' },
  { id: 'recommended', label: 'home_recommended' },
  { id: 'latest', label: 'home_latest' },
  { id: 'recent', label: 'home_recent' },
];

/* ======================= Preferences ======================= */
export function Preferences() {
  const { settings, update, t } = useSettings();
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div>
      <PageHeader title={t('pref_title')} back="/profile" />
      <div className="page-x pb-8">
        <Section title={t('pref_appearance')}>
          <Card className="space-y-5 p-4">
            <div>
              <div className="mb-2 text-[14px] font-medium text-ink">{t('pref_theme')}</div>
              <Segmented<ThemeMode>
                value={settings.theme}
                onChange={(theme) => update({ theme })}
                options={[
                  { value: 'dark', label: t('theme_dark'), icon: Moon },
                  { value: 'light', label: t('theme_light'), icon: Sun },
                  { value: 'system', label: t('theme_system'), icon: Monitor },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-[14px] font-medium text-ink">{t('pref_accent')}</div>
              <div className="flex flex-wrap gap-3">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    aria-label={t(`accent_${a.id}` as TKey)}
                    aria-pressed={settings.accent === a.id}
                    onClick={() => update({ accent: a.id })}
                    className={cx('flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition', settings.accent === a.id && 'ring-2 ring-ink')}
                    style={{ background: a.color }}
                  >
                    {settings.accent === a.id && <Check className="h-5 w-5 text-black" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[14px] font-medium text-ink">{t('pref_language')}</div>
              <Segmented
                value={settings.language}
                onChange={async (language) => {
                  await update({ language });
                  await invalidateQueries();
                }}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'he', label: 'עברית' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] font-medium text-ink">{t('pref_region')}</div>
              <select value={settings.region} onChange={(e) => update({ region: e.target.value })} className="rounded-full border hairline bg-elevated px-3 py-1.5 text-[14px] font-semibold text-ink outline-none">
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {new Intl.DisplayNames([settings.language], { type: 'region' }).of(r) ?? r}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        </Section>

        <Section title={t('pref_categories')} hint={t('pref_categories_hint')}>
          <Card className="divide-y divide-line/[0.07] px-4">
            {ALL_CATEGORIES.map((c) => {
              const on = settings.enabledCategories.includes(c);
              const fav = settings.favoriteCategories.includes(c);
              const Icon = CATEGORY_META[c].icon;
              return (
                <div key={c} className="flex items-center gap-3 py-2.5">
                  <Icon className="h-5 w-5 shrink-0" style={{ color: CATEGORY_META[c].color }} />
                  <span className="flex-1 text-[15px] font-medium text-ink">{t(CATEGORY_META[c].label)}</span>
                  <button
                    aria-pressed={fav}
                    disabled={!on}
                    onClick={() => update({ favoriteCategories: toggleIn(settings.favoriteCategories, c) })}
                    className={cx('rounded-full px-3 py-1 text-[12px] font-bold transition disabled:opacity-30', fav ? 'bg-accent/15 text-accent-ink' : 'bg-elevated text-faint')}
                  >
                    {fav ? `★ ${t('pref_favorite')}` : `☆ ${t('pref_favorite')}`}
                  </button>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={t(CATEGORY_META[c].label)}
                    onClick={() => {
                      const next = toggleIn(settings.enabledCategories, c);
                      if (!next.length) return;
                      update({ enabledCategories: next, favoriteCategories: on ? settings.favoriteCategories.filter((x) => x !== c) : settings.favoriteCategories });
                    }}
                    className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-accent' : 'bg-elevated border hairline')}
                  >
                    <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'end-0.5' : 'start-0.5')} />
                  </button>
                </div>
              );
            })}
          </Card>
        </Section>

        <Section title={t('pref_types')} hint={t('pref_types_hint')}>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k: ContentKind) => (
              <Chip
                key={k}
                active={settings.contentTypes.includes(k)}
                onClick={() => {
                  const next = toggleIn(settings.contentTypes, k);
                  if (next.length) update({ contentTypes: next });
                }}
              >
                {t(KIND_LABEL[k])}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t('pref_home')} hint={t('pref_home_hint')}>
          <Card className="divide-y divide-line/[0.07] px-4">
            {SECTIONS.map((s) => (
              <Toggle key={s.id} label={t(s.label)} checked={settings.homeSections[s.id]} onChange={(v) => update({ homeSections: { ...settings.homeSections, [s.id]: v } })} />
            ))}
          </Card>
        </Section>
      </div>
    </div>
  );
}

/* ======================= Integrations ======================= */
function KeyField({ service }: { service: 'tmdb' | 'rawg' }) {
  const { settings, update, t } = useSettings();
  const field = service === 'tmdb' ? 'tmdbKey' : 'rawgKey';
  const [value, setValue] = useState(settings[field]);
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');
  const toast = useToast();
  useEffect(() => setValue(settings[field]), [settings, field]);

  const validate = (v: string) => {
    const s = v.trim();
    if (!s) return '';
    if (/\s/.test(s)) return t('key_err_space');
    if (service === 'rawg' && !/^[a-f0-9]{32}$/i.test(s)) return t('key_err_rawg');
    if (service === 'tmdb' && !(/^[a-f0-9]{32}$/i.test(s) || /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(s))) return t('key_err_tmdb');
    return '';
  };

  const save = async () => {
    const e = validate(value);
    setErr(e);
    if (e) return;
    const v = value.trim();
    if (v) {
      setState('testing');
      try {
        await (service === 'tmdb' ? tmdb.verify(v) : rawg.verify(v));
        setState('ok');
      } catch (ex) {
        setState('error');
        setErr(isHttpError(ex) && ex.kind === 'auth' ? t('key_err_rejected') : t('key_err_network'));
        return;
      }
    }
    await update({ [field]: v } as never);
    await invalidateQueries();
    toast({ message: v ? t('key_saved') : t('key_removed'), tone: 'success' });
  };

  const name = service === 'tmdb' ? 'TMDB' : 'RAWG';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold text-ink">{name}</div>
          <div className="text-[13px] text-muted">{service === 'tmdb' ? t('int_tmdb_desc') : t('int_rawg_desc')}</div>
        </div>
        {settings[field] ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
            <CircleCheck className="h-3.5 w-3.5" />
            {t('int_connected')}
          </span>
        ) : (
          <span className="rounded-full bg-elevated px-2.5 py-1 text-[12px] font-bold text-faint">{t('int_not_connected')}</span>
        )}
      </div>
      <form
        className="mt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={`key-${service}`} className="mb-1.5 block text-[13px] font-semibold text-muted">
          {service === 'tmdb' ? t('int_tmdb_label') : t('int_rawg_label')}
        </label>
        <div className="relative">
          <input
            id={`key-${service}`}
            type={show ? 'text' : 'password'}
            className="input !pe-12 font-mono text-[14px]"
            value={value}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={service === 'tmdb' ? 'API key (v3) or Read Access Token' : 'API key'}
            aria-invalid={!!err}
            onChange={(e) => {
              setValue(e.target.value);
              setErr('');
              setState('idle');
            }}
          />
          <button type="button" aria-label={show ? t('key_hide') : t('key_show')} onClick={() => setShow((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-ink">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError>{err}</FieldError>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={state === 'testing' || value.trim() === settings[field]}>
            {state === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {state === 'testing' ? t('key_testing') : t('key_save_test')}
          </Button>
          {settings[field] && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                setValue('');
                await update({ [field]: '' } as never);
                await invalidateQueries();
                toast({ message: t('key_removed') });
              }}
            >
              {t('key_remove')}
            </Button>
          )}
          <a href={service === 'tmdb' ? 'https://www.themoviedb.org/settings/api' : 'https://rawg.io/apidocs'} target="_blank" rel="noopener noreferrer" className="ms-auto text-[13px] font-semibold text-accent-ink">
            {t('key_get', { name })}
          </a>
        </div>
      </form>
    </Card>
  );
}

export function Integrations() {
  const { t } = useSettings();
  return (
    <div>
      <PageHeader title={t('int_title')} back="/profile" />
      <div className="page-x space-y-4 pb-8">
        <div className="flex gap-3 rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div className="text-[13px] leading-relaxed text-muted">
            <div className="mb-1 text-[14px] font-semibold text-ink">{t('int_security_title')}</div>
            {t('int_security_body')}
          </div>
        </div>
        <KeyField service="tmdb" />
        <KeyField service="rawg" />
        <Card className="p-4">
          <div className="text-[15px] font-semibold text-ink">{t('int_free_title')}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('int_free_body')}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-[13px] text-ink">
            {['TVmaze', 'Wikipedia', 'Hacker News', 'Spaceflight News', 'ESPN', 'RSS'].map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <CircleCheck className="h-4 w-4 text-emerald-400" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-[12px] leading-relaxed text-faint">{t('attr_tmdb')}</p>
      </div>
    </div>
  );
}

/* ======================= Sources (RSS + sports) ======================= */
const CAT_OPTIONS = ALL_CATEGORIES;

function FeedForm({ onDone }: { onDone: () => void }) {
  const { settings, update, t } = useSettings();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<Category>('world');
  const [err, setErr] = useState<{ name?: string; url?: string }>({});
  const [testing, setTesting] = useState(false);
  const toast = useToast();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const next: typeof err = {};
        if (!name.trim()) next.name = t('feed_err_name');
        else if (name.trim().length > 40) next.name = t('feed_err_name_long');
        let parsed: URL | null = null;
        try {
          parsed = new URL(url.trim());
        } catch {
          parsed = null;
        }
        if (!parsed || !/^https?:$/.test(parsed.protocol)) next.url = t('feed_err_url');
        else if (settings.rssFeeds.some((f) => f.url === parsed!.toString())) next.url = t('feed_err_dup');
        setErr(next);
        if (Object.keys(next).length) return;
        const feed: RssFeed = { id: `custom-${Date.now().toString(36)}`, name: name.trim(), url: parsed!.toString(), category, enabled: true };
        setTesting(true);
        try {
          const items = await fetchFeed(feed, settings.rssProxies);
          if (!items.length) throw new Error('empty');
        } catch {
          setTesting(false);
          setErr({ url: t('feed_err_fetch') });
          return;
        }
        setTesting(false);
        await update({ rssFeeds: [...settings.rssFeeds, feed] });
        await invalidateQueries();
        toast({ message: t('feed_added'), tone: 'success' });
        onDone();
      }}
    >
      <div>
        <label htmlFor="feed-name" className="mb-1.5 block text-[13px] font-semibold text-muted">
          {t('feed_name')}
        </label>
        <input id="feed-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!err.name} />
        <FieldError>{err.name}</FieldError>
      </div>
      <div>
        <label htmlFor="feed-url" className="mb-1.5 block text-[13px] font-semibold text-muted">
          {t('feed_url')}
        </label>
        <input id="feed-url" type="url" inputMode="url" className="input" value={url} placeholder="https://example.com/feed.xml" onChange={(e) => setUrl(e.target.value)} aria-invalid={!!err.url} />
        <FieldError>{err.url}</FieldError>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-muted">{t('feed_category')}</div>
        <div className="flex flex-wrap gap-2">
          {CAT_OPTIONS.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {t(CATEGORY_META[c].label)}
            </Chip>
          ))}
        </div>
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={testing}>
        {testing && <Loader2 className="h-4 w-4 animate-spin" />}
        {testing ? t('feed_testing') : t('feed_add')}
      </Button>
    </form>
  );
}

export function Sources() {
  const { settings, update, t } = useSettings();
  const [adding, setAdding] = useState(false);
  const [proxyText, setProxyText] = useState(settings.rssProxies.join('\n'));
  const [proxyErr, setProxyErr] = useState('');
  const toast = useToast();
  const setFeeds = async (rssFeeds: RssFeed[]) => {
    await update({ rssFeeds });
    await invalidateQueries();
  };
  return (
    <div>
      <PageHeader title={t('src_title')} back="/profile" />
      <div className="page-x pb-8">
        <Section title={t('src_feeds')} hint={t('src_feeds_hint')}>
          <Card className="divide-y divide-line/[0.07] overflow-hidden">
            {settings.rssFeeds.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <Rss className="h-4 w-4 shrink-0" style={{ color: CATEGORY_META[f.category].color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-medium text-ink">{f.name}</div>
                  <div className="truncate text-[12px] text-faint">
                    {t(CATEGORY_META[f.category].label)} · {new URL(f.url).hostname}
                  </div>
                </div>
                {f.id.startsWith('custom-') && (
                  <button aria-label={t('delete')} onClick={() => void setFeeds(settings.rssFeeds.filter((x) => x.id !== f.id))} className="tap-target p-1.5 text-faint hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  role="switch"
                  aria-checked={f.enabled}
                  aria-label={f.name}
                  onClick={() => void setFeeds(settings.rssFeeds.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)))}
                  className={cx('relative h-7 w-12 shrink-0 rounded-full transition', f.enabled ? 'bg-accent' : 'border hairline bg-elevated')}
                >
                  <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', f.enabled ? 'end-0.5' : 'start-0.5')} />
                </button>
              </div>
            ))}
          </Card>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" icon={Plus} variant="primary" onClick={() => setAdding(true)}>
              {t('feed_add')}
            </Button>
            <Button
              size="sm"
              icon={RotateCcw}
              onClick={async () => {
                await setFeeds([...DEFAULT_RSS_FEEDS, ...settings.rssFeeds.filter((f) => f.id.startsWith('custom-'))]);
                toast({ message: t('src_reset_done') });
              }}
            >
              {t('src_reset')}
            </Button>
          </div>
        </Section>

        <Section title={t('src_proxy')} hint={t('src_proxy_hint')}>
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const lines = proxyText.split('\n').map((l) => l.trim()).filter(Boolean);
              const bad = lines.find((l) => l !== '{url}' && !/^https:\/\/[^\s]+$/.test(l));
              if (bad) return setProxyErr(t('src_proxy_err', { line: bad }));
              setProxyErr('');
              await update({ rssProxies: lines });
              await invalidateQueries();
              toast({ message: t('saved'), tone: 'success' });
            }}
          >
            <textarea className="input min-h-[96px] font-mono text-[13px]" value={proxyText} onChange={(e) => setProxyText(e.target.value)} spellCheck={false} aria-label={t('src_proxy')} />
            <FieldError>{proxyErr}</FieldError>
            <div className="mt-2 flex gap-2">
              <Button size="sm" type="submit" variant="primary">
                {t('save')}
              </Button>
              <Button size="sm" type="button" onClick={() => setProxyText(DEFAULT_RSS_PROXIES.join('\n'))}>
                {t('src_proxy_default')}
              </Button>
            </div>
          </form>
        </Section>

        <Section title={t('src_sports')} hint={t('src_sports_hint')}>
          <div className="flex flex-wrap gap-2">
            {LEAGUES.map((l) => {
              const on = settings.sportsLeagues.includes(l.id);
              return (
                <Chip
                  key={l.id}
                  active={on}
                  onClick={async () => {
                    const next = on ? settings.sportsLeagues.filter((x) => x !== l.id) : [...settings.sportsLeagues, l.id];
                    if (!next.length) return;
                    await update({ sportsLeagues: next });
                    await invalidateQueries();
                  }}
                >
                  {l.name}
                </Chip>
              );
            })}
          </div>
        </Section>
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title={t('feed_add')}>
        <FeedForm onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  );
}

/* ======================= Data ======================= */
export function DataPage() {
  const { t, settings } = useSettings();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [includeKeys, setIncludeKeys] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [importErr, setImportErr] = useState<ImportError | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmCache, setConfirmCache] = useState(false);
  const usage = useLiveQuery(async () => ({
    watchlist: await db.watchlist.count(),
    collections: await db.collections.count(),
    reminders: await db.reminders.count(),
    history: (await db.recent.count()) + (await db.reading.count()),
    cache: (await db.cache.count()) + (await db.items.count()),
  }), []);
  const errLabel: Record<ImportError, TKey> = { invalidJson: 'imp_err_json', notPulse: 'imp_err_pulse', unsupportedVersion: 'imp_err_version', invalidData: 'imp_err_data' };

  return (
    <div>
      <PageHeader title={t('data_title')} back="/profile" />
      <div className="page-x pb-8">
        <Section title={t('data_stored')} hint={t('data_local_hint')}>
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line/[0.06] sm:grid-cols-5">
            {usage &&
              ([
                ['stat_saved', usage.watchlist],
                ['stat_collections', usage.collections],
                ['stat_reminders', usage.reminders],
                ['data_history', usage.history],
                ['data_cache', usage.cache],
              ] as [TKey, number][]).map(([k, n]) => (
                <div key={k} className="bg-surface p-3.5">
                  <div className="font-display text-xl font-bold tabular-nums text-ink">{n}</div>
                  <div className="text-[12px] text-muted">{t(k)}</div>
                </div>
              ))}
          </Card>
        </Section>

        <Section title={t('data_export')} hint={t('data_export_hint')}>
          <Card className="px-4">
            <Toggle label={t('data_include_keys')} description={t('data_include_keys_desc')} checked={includeKeys} onChange={setIncludeKeys} />
          </Card>
          <Button
            className="mt-3"
            variant="primary"
            icon={Download}
            onClick={async () => {
              const b = await exportData(includeKeys);
              downloadFile(`pulse-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2), 'application/json');
              toast({ message: t('data_exported'), tone: 'success' });
            }}
          >
            {t('data_export_btn')}
          </Button>
        </Section>

        <Section title={t('data_import')} hint={t('data_import_hint')}>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 20 * 1024 * 1024) return setImportErr('invalidData');
              const res = parseBackup(await f.text());
              if (!res.ok) {
                setImportErr(res.error);
                return;
              }
              setImportErr(null);
              setPending(res.backup);
            }}
          />
          <Button icon={Upload} onClick={() => file.current?.click()}>
            {t('data_import_btn')}
          </Button>
          <FieldError>{importErr && t(errLabel[importErr])}</FieldError>
        </Section>

        <Section title={t('data_maintenance')}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setConfirmCache(true)}>
              {t('data_clear_cache')}
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>
              {t('data_reset')}
            </Button>
          </div>
        </Section>
      </div>

      <Sheet open={!!pending} onClose={() => setPending(null)} title={t('imp_title')}>
        {pending && (
          <div>
            <p className="text-[14px] text-muted">{t('imp_from', { date: relativeTime(pending.exportedAt, settings.language) })}</p>
            <ul className="mt-3 space-y-1 text-[14px] text-ink">
              {Object.entries(backupSummary(pending)).map(([k, v]) => (
                <li key={k} className="flex justify-between rounded-xl bg-elevated/50 px-3 py-2">
                  <span>{t(`imp_${k}` as TKey)}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                onClick={async () => {
                  await importData(pending, 'merge');
                  setPending(null);
                  toast({ message: t('imp_done'), tone: 'success' });
                }}
              >
                {t('imp_merge')}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await importData(pending, 'replace');
                  setPending(null);
                  toast({ message: t('imp_done'), tone: 'success' });
                }}
              >
                {t('imp_replace')}
              </Button>
            </div>
            <p className="mt-3 text-[12px] text-faint">{t('imp_modes')}</p>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirmCache}
        title={t('data_clear_cache')}
        body={t('data_clear_cache_body')}
        confirmLabel={t('clear')}
        onClose={() => setConfirmCache(false)}
        onConfirm={async () => {
          await db.items.clear();
          await invalidateQueries();
          if ('caches' in window) await caches.delete('pulse-images').catch(() => false);
          toast({ message: t('data_cache_cleared') });
        }}
      />
      <ConfirmSheet
        open={confirmReset}
        title={t('data_reset')}
        body={t('data_reset_body')}
        confirmLabel={t('data_reset_confirm')}
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetAll();
          window.location.replace(import.meta.env.BASE_URL);
        }}
      />
    </div>
  );
}

/* ======================= History ======================= */
export function HistoryPage() {
  const { t, settings } = useSettings();
  const [tab, setTab] = useState<'viewed' | 'read'>('viewed');
  const rows = useLiveQuery(() => (tab === 'viewed' ? db.recent : db.reading).orderBy('at').reverse().limit(60).toArray(), [tab]) ?? [];
  return (
    <div>
      <PageHeader title={t('hist_title')} back="/profile" />
      <div className="page-x mb-3 flex items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'viewed', label: t('hist_viewed') },
            { value: 'read', label: t('hist_read') },
          ]}
        />
        {rows.length > 0 && (
          <button onClick={() => void (tab === 'viewed' ? db.recent : db.reading).clear()} className="text-[13px] font-semibold text-accent-ink">
            {t('clearAll')}
          </button>
        )}
      </div>
      {rows.length ? (
        <div className="page-x divide-y divide-line/[0.07]">
          {rows.map((r) => (
            <CompactRow key={r.id} item={r.item} subtitle={`${r.item.sourceName ?? ''} · ${relativeTime(r.at, settings.language)}`} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Globe2} title={tab === 'viewed' ? t('hist_empty_viewed') : t('hist_empty_read')} body={t('hist_empty_body')} />
      )}
    </div>
  );
}

/* ======================= Install ======================= */
export function InstallPage() {
  const { t } = useSettings();
  const { canPrompt, prompt } = useInstallPrompt();
  const standalone = isStandalone();
  const ios = isIOS();
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-bold text-accent-ink">{n}</span>
      <span className="pt-0.5 text-[14.5px] leading-relaxed text-ink">{children}</span>
    </li>
  );
  return (
    <div>
      <PageHeader title={t('install_title')} back="/profile" />
      <div className="page-x space-y-4 pb-8">
        {standalone ? (
          <div className="flex items-center gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 text-[14px] text-ink">
            <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            {t('install_done')}
          </div>
        ) : canPrompt ? (
          <Card className="p-5">
            <div className="text-[16px] font-semibold text-ink">{t('install_ready')}</div>
            <p className="mt-1 text-[13.5px] text-muted">{t('install_ready_body')}</p>
            <Button variant="primary" className="mt-4" icon={Download} onClick={() => void prompt()}>
              {t('install_btn')}
            </Button>
          </Card>
        ) : null}

        <Card className={cx('p-5', ios && !standalone && 'ring-1 ring-accent/40')}>
          <div className="mb-3 text-[16px] font-semibold text-ink">{t('install_ios')}</div>
          <ol className="space-y-3">
            <Step n={1}>{t('install_ios_1')}</Step>
            <Step n={2}>
              <span className="inline-flex flex-wrap items-center gap-1">
                {t('install_ios_2a')} <Share className="inline h-4 w-4 text-accent-ink" /> {t('install_ios_2b')}
              </span>
            </Step>
            <Step n={3}>
              <span className="inline-flex flex-wrap items-center gap-1">
                {t('install_ios_3a')} <SquarePlus className="inline h-4 w-4 text-accent-ink" /> <b>{t('install_ios_3b')}</b>
              </span>
            </Step>
            <Step n={4}>{t('install_ios_4')}</Step>
          </ol>
        </Card>
        <Card className="p-5">
          <div className="mb-3 text-[16px] font-semibold text-ink">{t('install_android')}</div>
          <ol className="space-y-3">
            <Step n={1}>{t('install_android_1')}</Step>
            <Step n={2}>{t('install_android_2')}</Step>
            <Step n={3}>{t('install_android_3')}</Step>
          </ol>
        </Card>
        <Card className="p-5">
          <div className="mb-3 text-[16px] font-semibold text-ink">{t('install_desktop')}</div>
          <p className="text-[14px] leading-relaxed text-muted">{t('install_desktop_body')}</p>
        </Card>
        <Card className="p-5">
          <div className="mb-2 text-[16px] font-semibold text-ink">{t('install_update')}</div>
          <p className="text-[14px] leading-relaxed text-muted">{t('install_update_body')}</p>
        </Card>
      </div>
    </div>
  );
}

/* ======================= About ======================= */
export function AboutPage() {
  const { t } = useSettings();
  return (
    <div>
      <PageHeader title={t('about_title')} back="/profile" />
      <div className="page-x space-y-4 pb-8">
        <Card className="p-5">
          <div className="font-display text-2xl font-bold tracking-[0.18em] text-ink">PULSE</div>
          <div className="text-gradient font-semibold">{t('tagline')}</div>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">{t('about_body')}</p>
          <p className="mt-3 text-[12px] text-faint">
            v{__APP_VERSION__} · {t('about_built', { date: new Date(__BUILD_TIME__).toLocaleDateString() })}
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-2 text-[15px] font-semibold text-ink">{t('about_data')}</div>
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-muted">
            <li>{t('attr_tmdb')}</li>
            <li>{t('attr_rawg')} rawg.io</li>
            <li>{t('attr_tvmaze')}</li>
            <li>{t('attr_wikipedia')}</li>
            <li>{t('attr_other')}</li>
          </ul>
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-accent-ink" />
            {t('about_privacy')}
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted">{t('about_privacy_body')}</p>
        </Card>
        <div className="flex items-start gap-2 text-[12.5px] text-faint">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t('about_demo')}
        </div>
        <Link to="/profile/integrations" className="inline-block text-[13px] font-semibold text-accent-ink">
          {t('int_title')} →
        </Link>
      </div>
    </div>
  );
}
