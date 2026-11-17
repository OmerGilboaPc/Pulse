import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Bell, CalendarPlus, ChevronLeft, ExternalLink, FileQuestion, MessageSquare, Play, Share2, Star } from 'lucide-react';
import { useSettings } from '../store/settings';
import { useQuery } from '../hooks/useQuery';
import { detail } from '../services/content';
import { buildIcs, downloadFile, recordRead, recordView, safeFileName } from '../lib/actions';
import { formatDate, hostnameOf, parseDate, relativeTime } from '../lib/format';
import type { ContentItem, Trailer } from '../lib/types';
import { Cover } from '../components/content/Cover';
import { CategoryLabel, Countdown, DemoBadge, LandscapeCard, PopularityLine, PosterCard, primed } from '../components/content/Cards';
import { SaveButton } from '../components/content/SaveButton';
import { Rail, TrailerPlayer } from '../components/content/Hero';
import { Sheet, useToast } from '../components/ui/overlays';
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '../components/ui/primitives';
import { ReminderForm } from './Notifications';
import { isHttpError } from '../services/http';

function useShare() {
  const toast = useToast();
  const { t } = useSettings();
  return async (title: string, url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ message: t('linkCopied'), tone: 'success' });
    } catch {
      /* user cancelled */
    }
  };
}

export default function Detail() {
  const { id = '' } = useParams();
  const itemId = decodeURIComponent(id);
  const { settings, t, tx } = useSettings();
  const navigate = useNavigate();
  const share = useShare();
  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reminding, setReminding] = useState(false);
  const q = useQuery(`detail:${itemId}:${settings.language}:${settings.tmdbKey ? 1 : 0}${settings.rawgKey ? 1 : 0}`, () => detail(settings, itemId), 30 * 60_000);
  const item: ContentItem | undefined = q.data?.item ?? primed.get(itemId);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setExpanded(false);
  }, [itemId]);

  useEffect(() => {
    if (q.data?.item) void recordView(q.data.item);
  }, [q.data?.item]);

  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  if (!item && q.loading) {
    return (
      <div>
        <Skeleton className="aspect-[4/5] w-full rounded-none sm:aspect-[21/9]" />
        <div className="page-x -mt-20 space-y-3">
          <Skeleton className="h-8 w-3/4 rounded-full" />
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!item) {
    const notFound = isHttpError(q.error) && q.error.status === 404;
    return (
      <div className="pt-safe">
        <div className="page-x flex h-14 items-center">
          <button onClick={back} aria-label={t('back')} className="tap-target -ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-elevated">
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
        </div>
        {notFound ? (
          <EmptyState icon={FileQuestion} title={t('detail_missing')} body={t('detail_missing_body')} action={<Link to="/" className="font-semibold text-accent-ink">{t('nav_home')}</Link>} />
        ) : (
          <ErrorState error={q.error} onRetry={q.refresh} />
        )}
      </div>
    );
  }

  const d = q.data;
  const isMedia = item.kind === 'movie' || item.kind === 'tv' || item.kind === 'game';
  const future = (() => {
    const dt = parseDate(item.date);
    return !!dt && dt.getTime() > Date.now();
  })();
  const shareUrl = item.url ?? window.location.href;
  const tagline = item.meta?.tagline as string | undefined;
  const clip = item.meta?.clip as string | undefined;
  const discussion = item.meta?.discussion as string | undefined;
  const ev = item.kind === 'event' ? item.meta ?? {} : null;

  const addToCalendar = () => {
    const start = parseDate(item.date);
    if (!start) return;
    downloadFile(
      `${safeFileName(item.title)}.ics`,
      buildIcs([{ uid: item.id.replace(/[^a-z0-9]/gi, ''), title: `${item.title}${item.kind === 'event' ? '' : ` — ${t('cal_release')}`}`, start: start.getTime(), allDay: /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? ''), description: item.description, url: item.url }]),
      'text/calendar',
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Hero */}
      <div className="relative">
        <div className="relative aspect-[4/5] max-h-[78dvh] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9] lg:rounded-b-[36px]">
          <Cover item={item} sizes="lg" eager showArtTitle={false} />
          <div className="absolute inset-0 hero-fade" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
        </div>
        <div className="absolute inset-x-0 top-0 pt-safe">
          <div className="page-x flex h-14 items-center justify-between">
            <button onClick={back} aria-label={t('back')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
            <button onClick={() => void share(item.title, shareUrl)} aria-label={t('share')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
              <Share2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="page-x relative -mt-32 sm:-mt-40 lg:-mt-48">
        <div className="flex items-end gap-4">
          {isMedia && (item.poster || item.image) && (
            <div className="hidden aspect-[2/3] w-[150px] shrink-0 overflow-hidden rounded-2xl border hairline shadow-2xl sm:block lg:w-[200px]">
              <Cover item={item} variant="poster" />
            </div>
          )}
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryLabel item={item} />
              <DemoBadge item={item} />
              {future && <Countdown date={item.date} />}
              {ev?.state === 'in' && <Badge tone="live">{t('live')}</Badge>}
            </div>
            <h1 className="mt-2 font-display text-[30px] font-bold leading-[1.08] text-ink sm:text-4xl lg:text-5xl">{item.title}</h1>
            {tagline && <p className="mt-1.5 text-[15px] italic text-muted">“{tagline}”</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
              {item.date && <span>{item.kind === 'article' ? relativeTime(item.date, settings.language) : formatDate(item.date, settings.language, { month: 'long', day: 'numeric', year: 'numeric' })}</span>}
              {typeof item.rating === 'number' && item.rating > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.sourceName && <span>{item.sourceName}</span>}
              <PopularityLine item={item} />
            </div>
          </div>
        </div>

        {(item.genres?.length || item.platforms?.length) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...(item.genres ?? []), ...(item.platforms ?? [])].slice(0, 10).map((g) => (
              <span key={g} className="rounded-full border hairline bg-elevated/70 px-3 py-1 text-[12.5px] font-medium text-muted">
                {g}
              </span>
            ))}
          </div>
        ) : null}

        {ev && (
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-3xl border hairline bg-surface p-5 text-center">
            {[['away', 'awayLogo', 'awayScore'], ['home', 'homeLogo', 'homeScore']].map(([n, l, s], idx) => (
              <div key={n} className={idx === 1 ? 'order-3' : ''}>
                {ev[l] ? <img src={String(ev[l])} alt="" className="mx-auto h-12 w-12 object-contain" /> : <div className="mx-auto h-12 w-12 rounded-full bg-elevated" />}
                <div className="mt-2 text-[14px] font-semibold text-ink">{String(ev[n] ?? '')}</div>
                {ev.state !== 'pre' && <div className="font-display text-3xl font-bold tabular-nums text-ink">{String(ev[s] ?? '')}</div>}
              </div>
            ))}
            <div className="order-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{String(ev.status ?? 'vs')}</div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <SaveButton item={item} variant="full" className="flex-1 sm:flex-none" />
          {d?.trailers[0] && (
            <Button size="lg" icon={Play} onClick={() => setTrailer(d.trailers[0])}>
              {t('trailer')}
            </Button>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => item.kind === 'article' && void recordRead(item)}
              className="inline-flex h-12 items-center gap-2 rounded-full border hairline bg-elevated px-5 text-[15px] font-semibold text-ink"
            >
              <ExternalLink className="h-[18px] w-[18px]" />
              {item.kind === 'article' ? t('readAt', { site: hostnameOf(item.url) || item.sourceName || '' }) : t('openOn', { site: item.sourceName ?? hostnameOf(item.url) })}
            </a>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(future || item.kind === 'event') && item.date && (
            <Button size="sm" icon={CalendarPlus} onClick={addToCalendar}>
              {t('addToCalendar')}
            </Button>
          )}
          <Button size="sm" icon={Bell} onClick={() => setReminding(true)}>
            {t('rem_add')}
          </Button>
          {discussion && (
            <a href={discussion} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border hairline bg-elevated px-3.5 text-[13px] font-semibold text-ink">
              <MessageSquare className="h-4 w-4" />
              {t('discussion', { n: Number(item.meta?.comments ?? 0) })}
            </a>
          )}
        </div>

        {/* Description */}
        {item.description ? (
          <section className="mt-7 max-w-3xl">
            <h2 className="mb-2 text-[17px] font-semibold text-ink">{item.kind === 'article' ? t('detail_summary') : t('detail_overview')}</h2>
            <p className={`whitespace-pre-line text-[15.5px] leading-[1.7] text-ink/85 ${expanded ? '' : 'line-clamp-[8]'}`} style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.description}
            </p>
            {item.description.length > 420 && (
              <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[14px] font-semibold text-accent-ink">
                {expanded ? t('showLess') : t('readMore')}
              </button>
            )}
            {item.kind === 'article' && item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => void recordRead(item)} className="mt-4 flex items-center justify-between gap-3 rounded-2xl border hairline bg-surface p-4">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{t('detail_full_story')}</span>
                  <span className="block truncate text-[12.5px] text-muted">{item.url}</span>
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-accent-ink rtl:-scale-x-100" />
              </a>
            )}
          </section>
        ) : item.kind === 'article' ? (
          <p className="mt-6 text-[14px] text-muted">{t('detail_no_summary')}</p>
        ) : null}

        {/* Facts */}
        {d && d.facts.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('detail_facts')}</h2>
            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {d.facts.map((f) => (
                <div key={f.label} className="rounded-2xl border hairline bg-surface p-3.5">
                  <dt className="label-xs text-faint">{tx(`fact_${f.label}`, f.label)}</dt>
                  <dd className="mt-1 break-words text-[14px] font-medium text-ink">
                    {f.label === 'website' ? (
                      <a href={f.value} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                        {hostnameOf(f.value)}
                      </a>
                    ) : /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? (
                      formatDate(f.value, settings.language)
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {/* Cast */}
      {d && d.cast.length > 0 && (
        <Rail title={t('detail_cast')}>
          <div className="rail">
            {d.cast.map((p) => (
              <div key={`${p.name}-${p.role}`} className="w-[96px]">
                <div className="aspect-square overflow-hidden rounded-full border hairline bg-elevated">
                  {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-display text-xl font-bold text-faint">{p.name[0]}</div>}
                </div>
                <div className="mt-2 line-clamp-2 text-center text-[12.5px] font-semibold leading-tight text-ink">{p.name}</div>
                {p.role && <div className="line-clamp-1 text-center text-[11.5px] text-muted">{p.role}</div>}
              </div>
            ))}
          </div>
        </Rail>
      )}

      {/* Trailers & gallery */}
      {d && (d.trailers.length > 1 || d.gallery.length > 0 || clip) && (
        <Rail title={t('detail_media')}>
          <div className="rail">
            {d.trailers.map((tr) => (
              <button key={tr.key} onClick={() => setTrailer(tr)} className="group relative w-[78vw] max-w-[340px] overflow-hidden rounded-2xl border hairline sm:w-[320px]">
                <img src={`https://i.ytimg.com/vi/${tr.key}/hqdefault.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
                    <Play className="ms-0.5 h-5 w-5 fill-black" />
                  </span>
                </span>
              </button>
            ))}
            {clip && (
              <video src={clip} controls playsInline preload="none" poster={item.image} className="aspect-video w-[78vw] max-w-[340px] rounded-2xl border hairline bg-black sm:w-[320px]" />
            )}
            {d.gallery.map((g) => (
              <a key={g} href={g} target="_blank" rel="noopener noreferrer" className="block w-[78vw] max-w-[340px] overflow-hidden rounded-2xl border hairline sm:w-[320px]">
                <img src={g} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              </a>
            ))}
          </div>
        </Rail>
      )}

      {/* Related */}
      {d && d.related.length > 0 && (
        <Rail title={t('detail_related')}>
          <div className="rail">
            {d.related.map((r) => (r.kind === 'article' || r.kind === 'event' ? <LandscapeCard key={r.id} item={r} /> : <PosterCard key={r.id} item={r} />))}
          </div>
        </Rail>
      )}

      <div className="page-x mt-10 space-y-1 text-[12px] leading-relaxed text-faint">
        {item.isDemo && <p className="font-semibold text-amber-300">{t('demo_disclaimer')}</p>}
        {d && !d.live && !item.isDemo && <p>{t('detail_snapshot')}</p>}
        {q.stale && <p>{t('detail_stale')}</p>}
        {item.source === 'tmdb' && <p>{t('attr_tmdb')}</p>}
        {item.source === 'rawg' && (
          <p>
            {t('attr_rawg')}{' '}
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink">
              rawg.io
            </a>
          </p>
        )}
        {item.source === 'tvmaze' && <p>{t('attr_tvmaze')}</p>}
        {item.source === 'wikipedia' && <p>{t('attr_wikipedia')}</p>}
      </div>

      <TrailerPlayer trailer={trailer} onClose={() => setTrailer(null)} />
      <Sheet open={reminding} onClose={() => setReminding(false)} title={t('rem_add')}>
        <ReminderForm item={item} onDone={() => setReminding(false)} />
      </Sheet>
    </motion.div>
  );
}
