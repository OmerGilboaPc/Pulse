import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, MessageSquare, Star } from 'lucide-react';
import type { ContentItem } from '../../lib/types';
import { CATEGORY_META } from '../../lib/catalog';
import { compactNumber, daysUntil, formatDate, relativeTime, yearOf } from '../../lib/format';
import { useSettings } from '../../store/settings';
import { recordRead } from '../../lib/actions';
import { Cover } from './Cover';
import { SaveButton } from './SaveButton';
import { Badge, cx, Skeleton } from '../ui/primitives';
import type { TKey } from '../../lib/messages';

export const itemPath = (item: ContentItem) => `/item/${encodeURIComponent(item.id)}`;

/** Items primed for instant rendering on the detail page. */
export const primed = new Map<string, ContentItem>();
const prime = (item: ContentItem) => primed.set(item.id, item);

export function CategoryLabel({ item, onImage }: { item: ContentItem; onImage?: boolean }) {
  const { t, tx } = useSettings();
  const meta = CATEGORY_META[item.category];
  const sub = item.subcategory && item.subcategory !== 'general' && item.subcategory !== 'mostread' ? tx(`sub_${item.subcategory}`, '') : '';
  return (
    <span className={cx('inline-flex items-center gap-1.5 label-xs', onImage ? 'text-white/85' : 'text-muted')}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {t(meta.label)}
      {sub && <span className={onImage ? 'text-white/55' : 'text-faint'}>· {sub}</span>}
    </span>
  );
}

export function DemoBadge({ item }: { item: ContentItem }) {
  const { t } = useSettings();
  if (!item.isDemo) return null;
  return <Badge tone="demo">{t('sample')}</Badge>;
}

export function PopularityLine({ item }: { item: ContentItem }) {
  const { t, settings } = useSettings();
  const p = item.popularity;
  if (!p) return null;
  const metric: Record<typeof p.metric, TKey> = {
    tmdbPopularity: 'metric_tmdb',
    rawgAdded: 'metric_rawg',
    wikiViews: 'metric_wiki',
    hnPoints: 'metric_hn',
  };
  return (
    <span className="text-[12px] text-muted tabular-nums">
      {t(metric[p.metric], { n: compactNumber(p.value, settings.language) })}
    </span>
  );
}

export function Countdown({ date, className }: { date?: string; className?: string }) {
  const { t } = useSettings();
  const d = daysUntil(date);
  if (d === null) return null;
  const label = d < 0 ? t('cd_out') : d === 0 ? t('cd_today') : d === 1 ? t('cd_tomorrow') : t('cd_days', { n: d });
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', d < 0 ? 'bg-emerald-400/15 text-emerald-300' : d <= 7 ? 'bg-accent/20 text-accent-ink' : 'bg-white/10 text-white/90', className)}>
      {label}
    </span>
  );
}

function dateLabel(item: ContentItem, lang: 'en' | 'he') {
  if (!item.date) return '';
  if (item.kind === 'article') return relativeTime(item.date, lang);
  return formatDate(item.date, lang);
}

/* ---------- Poster card (movies, TV, games) ---------- */
export function PosterCard({ item, width = 'w-[38vw] max-w-[168px] sm:w-[160px]', showCountdown }: { item: ContentItem; width?: string; showCountdown?: boolean }) {
  const { settings } = useSettings();
  return (
    <motion.div whileTap={{ scale: 0.97 }} className={cx('group relative', width)}>
      <Link to={itemPath(item)} onClick={() => prime(item)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border hairline shadow-card">
          <Cover item={item} variant="poster" sizes="md" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
            <DemoBadge item={item} />
            {showCountdown && <Countdown date={item.date} />}
          </div>
          {typeof item.rating === 'number' && item.rating > 0 && (
            <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
              <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-2 px-0.5">
          <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{item.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-muted">
            {item.kind === 'game' ? item.platforms?.slice(0, 2).join(' · ') || yearOf(item.date) : [yearOf(item.date), item.genres?.[0]].filter(Boolean).join(' · ')}
            {showCountdown && item.date ? ` · ${formatDate(item.date, settings.language, { month: 'short', day: 'numeric' })}` : ''}
          </div>
        </div>
      </Link>
      <div className="absolute end-2 top-2">
        <SaveButton item={item} />
      </div>
    </motion.div>
  );
}

/* ---------- Landscape card (news, games, rails) ---------- */
export function LandscapeCard({ item, width = 'w-[78vw] max-w-[320px] sm:w-[300px]' }: { item: ContentItem; width?: string }) {
  const { settings } = useSettings();
  return (
    <motion.div whileTap={{ scale: 0.98 }} className={cx('group relative', width)}>
      <Link to={itemPath(item)} onClick={() => prime(item)} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border hairline shadow-card">
          <Cover item={item} sizes="md" />
          <div className="absolute inset-0 scrim-b" />
          <div className="absolute start-3 top-3 flex gap-1.5">
            <DemoBadge item={item} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <CategoryLabel item={item} onImage />
            <div className="mt-1 line-clamp-2 font-display text-[16px] font-semibold leading-snug text-white">{item.title}</div>
            <div className="mt-1 truncate text-[12px] text-white/65">
              {[item.sourceName, dateLabel(item, settings.language)].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      </Link>
      <div className="absolute end-3 top-3">
        <SaveButton item={item} />
      </div>
    </motion.div>
  );
}

/* ---------- Editorial card (feed) ---------- */
export function EditorialCard({ item, large }: { item: ContentItem; large?: boolean }) {
  const { settings, t } = useSettings();
  const comments = item.meta?.comments;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className="group overflow-hidden rounded-3xl border hairline bg-surface shadow-card"
    >
      <Link to={itemPath(item)} onClick={() => prime(item)} className="block">
        <div className={cx('relative overflow-hidden', large ? 'aspect-[16/10]' : 'aspect-[16/9]')}>
          <Cover item={item} sizes={large ? 'lg' : 'md'} />
          <div className="absolute start-3 top-3 flex gap-1.5">
            <DemoBadge item={item} />
          </div>
        </div>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <CategoryLabel item={item} />
            {item.date && <span className="shrink-0 text-[12px] text-faint">{dateLabel(item, settings.language)}</span>}
          </div>
          <h3 className={cx('mt-1.5 font-display font-semibold leading-snug text-ink', large ? 'text-xl' : 'text-[17px]', 'line-clamp-3')}>{item.title}</h3>
          {item.description && <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-muted">{item.description}</p>}
        </div>
      </Link>
      <div className="flex items-center gap-2 px-4 pb-3.5 pt-1">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-muted">
          {item.sourceName}
          {item.popularity && <span className="text-faint"> · <PopularityLine item={item} /></span>}
          {typeof comments === 'number' && (
            <span className="ms-2 inline-flex items-center gap-1 text-faint">
              <MessageSquare className="h-3 w-3" />
              {comments}
            </span>
          )}
        </span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void recordRead(item)}
            aria-label={t('openSource')}
            title={t('openSource')}
            className="tap-target inline-flex h-9 w-9 items-center justify-center rounded-full border hairline bg-elevated text-muted hover:text-ink"
          >
            <ArrowUpRight className="h-[17px] w-[17px] rtl:-scale-x-100" />
          </a>
        )}
        <SaveButton item={item} variant="plain" />
      </div>
    </motion.article>
  );
}

/* ---------- Compact row (lists, search results) ---------- */
export function CompactRow({ item, right, showCountdown, subtitle }: { item: ContentItem; right?: React.ReactNode; showCountdown?: boolean; subtitle?: string }) {
  const { settings } = useSettings();
  const portrait = item.kind === 'movie' || item.kind === 'tv';
  return (
    <div className="group flex items-center gap-3 py-2.5">
      <Link to={itemPath(item)} onClick={() => prime(item)} className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cx('relative shrink-0 overflow-hidden rounded-xl border hairline', portrait ? 'h-[84px] w-[56px]' : 'h-[64px] w-[88px]')}>
          <Cover item={item} variant={portrait ? 'poster' : 'wide'} sizes="sm" showArtTitle={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CategoryLabel item={item} />
            <DemoBadge item={item} />
          </div>
          <div className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{item.title}</div>
          <div className="mt-0.5 flex items-center gap-2 truncate text-[12.5px] text-muted">
            {showCountdown && <Countdown date={item.date} />}
            <span className="truncate">{subtitle ?? [item.sourceName, dateLabel(item, settings.language)].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      </Link>
      {right ?? <SaveButton item={item} variant="plain" />}
    </div>
  );
}

/* ---------- Ranking card ---------- */
export function RankCard({ item, rank }: { item: ContentItem; rank: number }) {
  const { settings } = useSettings();
  const portrait = item.kind === 'movie' || item.kind === 'tv';
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link to={itemPath(item)} onClick={() => prime(item)} className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cx('w-8 shrink-0 text-center font-display text-[26px] font-bold leading-none tabular-nums', rank <= 3 ? 'text-gradient' : 'text-faint')}>{rank}</span>
        <div className={cx('relative shrink-0 overflow-hidden rounded-xl border hairline', portrait ? 'h-[78px] w-[52px]' : 'h-[58px] w-[80px]')}>
          <Cover item={item} variant={portrait ? 'poster' : 'wide'} sizes="sm" showArtTitle={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{item.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            <PopularityLine item={item} />
            <span className="truncate text-faint">{item.kind === 'article' ? item.sourceName : yearOf(item.date) || formatDate(item.date, settings.language)}</span>
          </div>
        </div>
      </Link>
      <SaveButton item={item} variant="plain" />
    </div>
  );
}

/* ---------- Sports event card ---------- */
export function EventCard({ item }: { item: ContentItem }) {
  const { t, settings } = useSettings();
  const m = item.meta ?? {};
  const live = m.state === 'in';
  const done = m.state === 'post';
  const row = (name: unknown, logo: unknown, score: unknown) => (
    <div className="flex items-center gap-2.5">
      {logo ? <img src={String(logo)} alt="" loading="lazy" className="h-7 w-7 object-contain" /> : <span className="h-7 w-7 rounded-full bg-elevated" />}
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{String(name ?? '')}</span>
      {(live || done) && score !== undefined && <span className="font-display text-lg font-bold tabular-nums text-ink">{String(score)}</span>}
    </div>
  );
  return (
    <Link to={itemPath(item)} onClick={() => prime(item)} className="block w-[72vw] max-w-[280px] rounded-3xl border hairline bg-surface p-4 shadow-card sm:w-[260px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate label-xs text-muted">{String(m.leagueName ?? '')}</span>
        {live ? <Badge tone="live">{t('live')}</Badge> : <span className="shrink-0 text-[12px] text-faint">{done ? t('final') : formatDate(item.date, settings.language, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
      </div>
      <div className="space-y-2.5">
        {row(m.away, m.awayLogo, m.awayScore)}
        {row(m.home, m.homeLogo, m.homeScore)}
      </div>
      {m.status && <div className="mt-3 truncate text-[12px] text-muted">{String(m.status)}</div>}
    </Link>
  );
}

/* ---------- Skeletons ---------- */

export function RailSkeleton({ kind = 'poster', count = 5 }: { kind?: 'poster' | 'landscape' | 'event'; count?: number }) {
  return (
    <div className="rail" aria-hidden>
      {Array.from({ length: count }, (_, i) =>
        kind === 'poster' ? (
          <div key={i} className="w-[38vw] max-w-[168px] sm:w-[160px]">
            <Skeleton className="aspect-[2/3]" />
            <Skeleton className="mt-2 h-3.5 w-4/5 rounded-full" />
            <Skeleton className="mt-1.5 h-3 w-1/2 rounded-full" />
          </div>
        ) : kind === 'event' ? (
          <Skeleton key={i} className="h-[150px] w-[72vw] max-w-[280px] rounded-3xl sm:w-[260px]" />
        ) : (
          <Skeleton key={i} className="aspect-[16/10] w-[78vw] max-w-[320px] rounded-3xl sm:w-[300px]" />
        ),
      )}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="page-x space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-[64px] w-[88px] rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/4 rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border hairline bg-surface">
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/4 rounded-full" />
            <Skeleton className="h-5 w-11/12 rounded-full" />
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
