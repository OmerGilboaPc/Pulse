import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Clock, Flame, KeyRound, Newspaper, Sparkles, X } from 'lucide-react';
import { useSettings } from '../store/settings';
import { useQuery } from '../hooks/useQuery';
import { db } from '../lib/db';
import { settingsSig } from '../lib/actions';
import { featured, hasRawg, hasTmdb, latestNews, recommended, trending, upcoming, type SectionState } from '../services/content';
import type { Category, ContentItem } from '../lib/types';
import { CATEGORY_META, DISCOVER_SECTIONS } from '../lib/catalog';
import { formatDate } from '../lib/format';
import { Logo, SearchFab } from '../components/layout/Shell';
import { HeroCarousel, Rail } from '../components/content/Hero';
import { EditorialCard, FeedSkeleton, LandscapeCard, PosterCard, RailSkeleton } from '../components/content/Cards';
import { SourceHealth } from '../components/content/SourceHealth';
import { Button, Chip, ChipRow, EmptyState, ErrorState, Freshness, Skeleton, cx } from '../components/ui/primitives';

function greetingKey(h: number) {
  if (h < 5) return 'greet_night' as const;
  if (h < 12) return 'greet_morning' as const;
  if (h < 18) return 'greet_afternoon' as const;
  return 'greet_evening' as const;
}

const PROMO_KEY = 'pulse:hidePromo';

export default function Home() {
  const { settings, t } = useSettings();
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [visible, setVisible] = useState(9);
  const [hidePromo, setHidePromo] = useState(() => {
    try {
      return localStorage.getItem(PROMO_KEY) === '1';
    } catch {
      return false;
    }
  });
  const sig = settingsSig(settings);
  const sections = settings.homeSections;

  const featuredQ = useQuery(sections.featured ? `home:featured:${sig}` : null, () => featured(settings), 30 * 60_000);
  const latestQ = useQuery(sections.latest ? `home:latest:${sig}` : null, () => latestNews(settings), 10 * 60_000);
  const trendingQ = useQuery(sections.trending ? `trending:${sig}` : null, () => trending(settings), 30 * 60_000);
  const upcomingQ = useQuery(sections.upcoming ? `upcoming:60:${sig}` : null, () => upcoming(settings, 60), 6 * 3600_000);
  const saved = useLiveQuery(() => db.watchlist.orderBy('addedAt').reverse().limit(8).toArray(), []);
  const recQ = useQuery(
    sections.recommended && saved ? `home:rec:${sig}:${saved.slice(0, 3).map((s) => s.id).join(',')}` : null,
    () => recommended(settings, saved ?? []),
    60 * 60_000,
  );
  const recent = useLiveQuery(() => db.recent.orderBy('at').reverse().limit(14).toArray(), []) ?? [];

  const pass = (i: ContentItem) =>
    settings.enabledCategories.includes(i.category) && settings.contentTypes.includes(i.kind) && (filter === 'all' || i.category === filter);

  const trendingItems = useMemo(() => {
    const d = trendingQ.data;
    if (!d) return [];
    const take = (s: SectionState, n: number) => (s.status === 'ok' ? s.items.slice(0, n) : []);
    const lists = [take(d.movies, 5), take(d.tv, 5), take(d.games, 5), take(d.news, 4), take(d.tech, 3)];
    const out: ContentItem[] = [];
    for (let i = 0; i < 5; i++) for (const l of lists) if (l[i]) out.push(l[i]);
    return out;
  }, [trendingQ.data]);

  const now = new Date();
  const name = settings.name.trim();
  const featuredItems = (featuredQ.data?.items ?? []).filter(pass);
  const latestItems = (latestQ.data?.items ?? []).filter(pass);
  const upcomingItems = (upcomingQ.data?.items ?? []).filter(pass).slice(0, 16);
  const recItems = (recQ.data?.items ?? []).filter(pass);
  const recentItems = recent.map((r) => r.item).filter(pass);
  const trendingFiltered = trendingItems.filter(pass);
  const quickCats = settings.enabledCategories;
  const missingKeys = !hasTmdb(settings) || !hasRawg(settings);

  return (
    <div>
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass border-b hairline pt-safe lg:hidden">
        <div className="page-x flex h-14 items-center justify-between">
          <Link to="/" aria-label="PULSE">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/calendar" aria-label={t('nav_calendar')} className="tap-target flex h-10 w-10 items-center justify-center rounded-full border hairline bg-elevated/80 text-ink">
              <CalendarDays className="h-[18px] w-[18px]" />
            </Link>
            <SearchFab />
          </div>
        </div>
      </header>

      {/* Greeting */}
      <section className="page-x pb-5 pt-5 lg:pt-10">
        <div className="label-xs text-accent-ink">{formatDate(now.toISOString(), settings.language, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1 className="mt-1.5 text-[30px] font-bold leading-[1.1] text-ink lg:text-[44px]">
          {t(greetingKey(now.getHours()))}
          {name ? <span className="text-gradient">, {name}</span> : null}
        </h1>
        <p className="mt-1 text-[15px] text-muted">{t('home_sub')}</p>
      </section>

      {/* Category filter */}
      <ChipRow className="sticky top-[calc(56px+var(--safe-top))] z-20 -mt-1 bg-bg/80 py-2 backdrop-blur-xl lg:top-0">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')}
        </Chip>
        {quickCats.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)} icon={CATEGORY_META[c].icon}>
            {t(CATEGORY_META[c].label)}
          </Chip>
        ))}
      </ChipRow>

      {/* Quick navigation */}
      {sections.quick && (
        <nav aria-label={t('home_quick')} className="rail mt-4 !gap-2.5">
          {DISCOVER_SECTIONS.filter((d) => d.categories.some((c) => settings.enabledCategories.includes(c))).map((d) => (
            <Link
              key={d.slug}
              to={`/discover/${d.slug}`}
              className="group flex w-[104px] flex-col items-center gap-2 rounded-3xl border hairline bg-surface px-2 py-3.5 transition active:scale-95"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: `linear-gradient(140deg, hsl(${d.hue} 85% 60% / 0.28), hsl(${d.hue + 40} 85% 50% / 0.12))` }}
              >
                <d.icon className="h-5 w-5" style={{ color: `hsl(${d.hue} 90% 72%)` }} />
              </span>
              <span className="text-center text-[12px] font-semibold leading-tight text-ink">{t(d.label)}</span>
            </Link>
          ))}
          <Link to="/calendar" className="flex w-[104px] flex-col items-center gap-2 rounded-3xl border hairline bg-surface px-2 py-3.5 transition active:scale-95">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
              <CalendarDays className="h-5 w-5 text-accent-ink" />
            </span>
            <span className="text-center text-[12px] font-semibold leading-tight text-ink">{t('nav_calendar')}</span>
          </Link>
        </nav>
      )}

      {/* Featured */}
      {sections.featured && (
        <div className="mt-6">
          {featuredQ.loading ? (
            <div className="page-x">
              <Skeleton className="aspect-[4/5] rounded-[28px] sm:aspect-[16/9] lg:aspect-[21/9]" />
            </div>
          ) : featuredItems.length ? (
            <HeroCarousel items={featuredItems} />
          ) : featuredQ.error && !featuredQ.data ? (
            <ErrorState compact error={featuredQ.error} onRetry={featuredQ.refresh} />
          ) : null}
        </div>
      )}

      {missingKeys && !hidePromo && (
        <div className="page-x mt-5">
          <div className="relative flex items-center gap-3 overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 to-transparent p-4">
            <KeyRound className="h-6 w-6 shrink-0 text-accent-ink" />
            <Link to="/profile/integrations" className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold text-ink">{t('promo_title')}</div>
              <div className="text-[13px] leading-snug text-muted">{t('promo_body')}</div>
            </Link>
            <button
              aria-label={t('dismiss')}
              onClick={() => {
                setHidePromo(true);
                try {
                  localStorage.setItem(PROMO_KEY, '1');
                } catch {
                  /* ignore */
                }
              }}
              className="tap-target shrink-0 text-faint hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Trending */}
      {sections.trending && (
        <Rail title={t('home_trending')} icon={Flame} to="/trending" subtitle={<Freshness updatedAt={trendingQ.updatedAt} stale={trendingQ.stale} />}>
          {trendingQ.loading ? (
            <RailSkeleton />
          ) : trendingFiltered.length ? (
            <div className="rail">
              {trendingFiltered.map((i) => (i.kind === 'article' ? <LandscapeCard key={i.id} item={i} /> : <PosterCard key={i.id} item={i} />))}
            </div>
          ) : trendingQ.error ? (
            <ErrorState compact error={trendingQ.error} onRetry={trendingQ.refresh} />
          ) : (
            <p className="page-x text-[14px] text-muted">{t('nothing_filter')}</p>
          )}
        </Rail>
      )}

      {/* Upcoming */}
      {sections.upcoming && (upcomingQ.loading || upcomingItems.length > 0 || !!upcomingQ.error) && (
        <Rail title={t('home_upcoming')} icon={CalendarDays} to="/calendar" subtitle={t('home_upcoming_sub')}>
          {upcomingQ.loading ? (
            <RailSkeleton />
          ) : upcomingItems.length ? (
            <div className="rail">
              {upcomingItems.map((i) => (
                <PosterCard key={i.id} item={i} showCountdown />
              ))}
            </div>
          ) : (
            <ErrorState compact error={upcomingQ.error} onRetry={upcomingQ.refresh} />
          )}
        </Rail>
      )}

      {/* Recommended */}
      {sections.recommended && (recQ.loading || recItems.length > 0) && (
        <Rail
          title={t('home_recommended')}
          icon={Sparkles}
          subtitle={recQ.data?.basis ? t('home_because', { title: recQ.data.basis }) : t('home_rec_sub')}
        >
          {recQ.loading ? (
            <RailSkeleton />
          ) : (
            <div className="rail">
              {recItems.map((i) => (i.kind === 'article' ? <LandscapeCard key={i.id} item={i} /> : <PosterCard key={i.id} item={i} />))}
            </div>
          )}
        </Rail>
      )}

      {/* Latest */}
      {sections.latest && (
        <section className="mt-9">
          <div className="page-x mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <h2 className="flex items-center gap-2 text-[19px] font-semibold text-ink lg:text-[22px]">
              <Newspaper className="h-5 w-5 text-accent-ink" />
              {t('home_latest')}
            </h2>
            <div className="flex items-center gap-3">
              <Freshness updatedAt={latestQ.updatedAt} stale={latestQ.stale} refreshing={latestQ.refreshing} onRefresh={latestQ.refresh} />
              <SourceHealth sources={latestQ.data?.sources} />
            </div>
          </div>
          {latestQ.loading ? (
            <FeedSkeleton count={3} />
          ) : latestItems.length ? (
            <>
              <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {latestItems.slice(0, visible).map((i, idx) => (
                  <div key={i.id} className={cx(idx === 0 && 'sm:col-span-2 xl:col-span-2')}>
                    <EditorialCard item={i} large={idx === 0} />
                  </div>
                ))}
              </div>
              {latestItems.length > visible && (
                <div className="mt-5 flex justify-center">
                  <Button onClick={() => setVisible((v) => v + 9)}>{t('loadMore')}</Button>
                </div>
              )}
            </>
          ) : latestQ.error ? (
            <ErrorState error={latestQ.error} onRetry={latestQ.refresh} />
          ) : (
            <EmptyState icon={Newspaper} title={t('home_latest_empty')} body={t('home_latest_empty_body')} />
          )}
        </section>
      )}

      {/* Recently viewed */}
      {sections.recent && recentItems.length > 0 && (
        <Rail title={t('home_recent')} icon={Clock} to="/profile/history">
          <div className="rail">
            {recentItems.map((i) => (i.kind === 'article' || i.kind === 'event' ? <LandscapeCard key={i.id} item={i} width="w-[64vw] max-w-[260px] sm:w-[240px]" /> : <PosterCard key={i.id} item={i} width="w-[30vw] max-w-[132px] sm:w-[128px]" />))}
          </div>
        </Rail>
      )}
      <div className="h-6" />
    </div>
  );
}
