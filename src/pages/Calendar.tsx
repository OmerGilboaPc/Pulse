import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, BellRing, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useSettings } from '../store/settings';
import { useQuery } from '../hooks/useQuery';
import { db } from '../lib/db';
import { ensureReleaseReminder, settingsSig } from '../lib/actions';
import { hasRawg, hasTmdb, upcoming } from '../services/content';
import { addDays, formatDate, localeOf, parseDate, ymd } from '../lib/format';
import { CATEGORY_META } from '../lib/catalog';
import type { Category, ContentItem } from '../lib/types';
import { PageHeader } from '../components/layout/Shell';
import { CompactRow, ListSkeleton } from '../components/content/Cards';
import { SaveButton } from '../components/content/SaveButton';
import { SourceHealth } from '../components/content/SourceHealth';
import { useToast } from '../components/ui/overlays';
import { Chip, ChipRow, cx, EmptyState, ErrorState, Freshness, NeedsKey, Segmented } from '../components/ui/primitives';
import { permission, requestPermission } from '../lib/notify';

type Filter = 'all' | 'movies' | 'tv' | 'games';

function ReminderButton({ item }: { item: ContentItem }) {
  const { settings, t, update } = useSettings();
  const toast = useToast();
  const has = useLiveQuery(() => db.reminders.where('itemId').equals(item.id).filter((r) => r.type === 'release' && !r.fired).count(), [item.id]) ?? 0;
  return (
    <button
      aria-label={has ? t('cal_reminder_on') : t('cal_remind')}
      title={has ? t('cal_reminder_on') : t('cal_remind')}
      onClick={async () => {
        if (has) {
          await db.reminders.where('itemId').equals(item.id).filter((r) => r.type === 'release').delete();
          toast({ message: t('cal_reminder_removed') });
          return;
        }
        const r = await ensureReleaseReminder(item, settings.notifications.releaseLeadDays);
        if (!r) {
          toast({ message: t('cal_reminder_past'), tone: 'error' });
          return;
        }
        if (!settings.notifications.enabled && permission() !== 'unsupported') {
          const p = await requestPermission();
          if (p === 'granted') await update((s) => ({ notifications: { ...s.notifications, enabled: true } }));
        }
        toast({ message: t('cal_reminder_set', { date: formatDate(r.at, settings.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }), tone: 'success' });
      }}
      className={cx('tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border hairline transition active:scale-90', has ? 'bg-accent/15 text-accent-ink' : 'bg-elevated text-muted hover:text-ink')}
    >
      {has ? <BellRing className="h-[17px] w-[17px]" /> : <Bell className="h-[17px] w-[17px]" />}
    </button>
  );
}

function ItemRow({ item }: { item: ContentItem }) {
  const { tx } = useSettings();
  const sub = item.subtitle === 'seriesPremiere' ? tx('cal_series_premiere') : item.subtitle?.startsWith('S') && item.source === 'tvmaze' ? tx('cal_season_premiere').replace('{n}', item.subtitle.slice(1)) : undefined;
  return (
    <CompactRow
      item={item}
      showCountdown
      subtitle={[sub, item.sourceName, item.platforms?.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
      right={
        <div className="flex shrink-0 gap-2">
          <ReminderButton item={item} />
          <SaveButton item={item} variant="plain" />
        </div>
      }
    />
  );
}

export default function Calendar() {
  const { settings, t } = useSettings();
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'list' | 'month'>('list');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(ymd(new Date()));
  const q = useQuery(`upcoming:120:${settingsSig(settings)}`, () => upcoming(settings, 120), 6 * 3600_000);

  const cats: Category[] = (['movies', 'tv', 'games'] as Category[]).filter((c) => settings.enabledCategories.includes(c));
  const items = useMemo(() => (q.data?.items ?? []).filter((i) => filter === 'all' || i.category === filter), [q.data, filter]);
  const byDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    for (const i of items) {
      const d = parseDate(i.date);
      if (!d) continue;
      const k = ymd(d);
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  }, [items]);

  const locale = localeOf(settings.language);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + i)));
  const firstDow = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = ymd(new Date());

  const missing: ('tmdb' | 'rawg')[] = [];
  if (settings.enabledCategories.includes('movies') && !hasTmdb(settings) && (filter === 'all' || filter === 'movies')) missing.push('tmdb');
  if (settings.enabledCategories.includes('games') && !hasRawg(settings) && (filter === 'all' || filter === 'games')) missing.push('rawg');

  const groups = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const selectedItems = byDay.get(selected) ?? [];

  return (
    <div>
      <PageHeader
        title={t('nav_calendar')}
        back
        subtitle={
          <span className="flex flex-wrap items-center gap-3">
            {t('cal_sub')}
            <Freshness updatedAt={q.updatedAt} stale={q.stale} />
            <SourceHealth sources={q.data?.sources} />
          </span>
        }
      />
      <div className="page-x mb-3 flex items-center justify-between gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: t('cal_list'), icon: List },
            { value: 'month', label: t('cal_month'), icon: LayoutGrid },
          ]}
        />
      </div>
      <ChipRow>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')}
        </Chip>
        {cats.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c as Filter)} color={CATEGORY_META[c].color}>
            {t(CATEGORY_META[c].label)}
          </Chip>
        ))}
      </ChipRow>

      {missing.length > 0 && (
        <div className="mt-4 space-y-3">
          {missing.map((m) => (
            <NeedsKey key={m} service={m} compact />
          ))}
        </div>
      )}

      {q.loading ? (
        <div className="mt-6">
          <ListSkeleton count={6} />
        </div>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : view === 'month' ? (
        <div className="page-x mt-5 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-8">
          <div className="rounded-[28px] border hairline bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <button aria-label={t('cal_prev')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-ink">
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
              <div className="font-display text-[17px] font-semibold text-ink">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}</div>
              <button aria-label={t('cal_next')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-ink">
                <ChevronRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdays.map((w, i) => (
                <div key={i} className="pb-1 text-[11px] font-semibold text-faint">
                  {w}
                </div>
              ))}
              {Array.from({ length: firstDow }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
                const k = ymd(d);
                const list = byDay.get(k) ?? [];
                const colors = [...new Set(list.map((x) => CATEGORY_META[x.category].color))].slice(0, 3);
                const isSel = k === selected;
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    aria-label={`${formatDate(k, settings.language)} — ${list.length}`}
                    aria-pressed={isSel}
                    className={cx(
                      'relative flex aspect-square flex-col items-center justify-center rounded-2xl text-[14px] font-semibold tabular-nums transition',
                      isSel ? 'bg-accent-gradient text-on-accent' : k === today ? 'bg-accent/12 text-accent-ink ring-1 ring-accent/40' : list.length ? 'text-ink hover:bg-elevated' : 'text-faint hover:bg-elevated/50',
                    )}
                  >
                    {i + 1}
                    {colors.length > 0 && (
                      <span className="absolute bottom-1.5 flex gap-0.5">
                        {colors.map((c) => (
                          <span key={c} className="h-1 w-1 rounded-full" style={{ background: isSel ? 'currentColor' : c }} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                const d = new Date();
                setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                setSelected(ymd(d));
              }}
              className="mt-3 w-full rounded-full bg-elevated py-2 text-[13px] font-semibold text-ink"
            >
              {t('cal_today')}
            </button>
          </div>
          <div className="mt-6 lg:mt-0">
            <h2 className="mb-1 text-[17px] font-semibold text-ink">{formatDate(selected, settings.language, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            {selectedItems.length ? (
              <div className="divide-y divide-line/[0.07]">
                {selectedItems.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-[14px] text-muted">{t('cal_none_day')}</p>
            )}
          </div>
        </div>
      ) : groups.length ? (
        <div className="page-x mt-4">
          {groups.map(([day, list]) => {
            const d = parseDate(day)!;
            const isToday = day === today;
            const isTomorrow = day === ymd(addDays(new Date(), 1));
            return (
              <section key={day} className="mb-4">
                <div className="sticky top-[calc(56px+var(--safe-top))] z-10 -mx-4 flex items-baseline gap-2 bg-bg/85 px-4 py-2 backdrop-blur-xl lg:top-14 lg:-mx-8 lg:px-8">
                  <span className="font-display text-[22px] font-bold tabular-nums text-ink">{d.getDate()}</span>
                  <span className="text-[13px] font-semibold text-muted">
                    {isToday ? t('cd_today') : isTomorrow ? t('cd_tomorrow') : formatDate(day, settings.language, { weekday: 'long', month: 'long' })}
                  </span>
                  <span className="ms-auto text-[12px] text-faint">{t('cal_count', { n: list.length })}</span>
                </div>
                <div className="divide-y divide-line/[0.07]">
                  {list.map((i) => (
                    <ItemRow key={i.id} item={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title={t('cal_empty')} body={t('cal_empty_body')} />
      )}
    </div>
  );
}
