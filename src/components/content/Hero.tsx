import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Play, X } from 'lucide-react';
import type { ContentItem, Trailer } from '../../lib/types';
import { useSettings } from '../../store/settings';
import { formatDate, truncate } from '../../lib/format';
import { Cover } from './Cover';
import { CategoryLabel, DemoBadge, itemPath, primed } from './Cards';
import { SaveButton } from './SaveButton';
import { Sheet } from '../ui/overlays';
import { cx, SectionHeader } from '../ui/primitives';

export function HeroCarousel({ items, interval = 6500 }: { items: ContentItem[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { t, settings } = useSettings();
  const startX = useRef<number | null>(null);
  const count = items.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(id);
  }, [paused, count, interval]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (!count) return null;
  const item = items[Math.min(index, count - 1)];
  const rtl = settings.language === 'he';

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('home_featured')}
      className="page-x"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[28px] border hairline bg-surface shadow-card sm:aspect-[16/9] lg:aspect-[21/9]"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (startX.current ?? 0);
          if (Math.abs(dx) > 40) setIndex((i) => (i + ((dx < 0) !== rtl ? 1 : -1) + count) % count);
          startX.current = null;
          setTimeout(() => setPaused(false), 4000);
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={item.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Cover item={item} sizes="lg" showArtTitle={false} eager />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent rtl:bg-gradient-to-l" />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:max-w-[60%] lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }}>
              <div className="mb-2 flex items-center gap-2">
                <CategoryLabel item={item} onImage />
                <DemoBadge item={item} />
              </div>
              <Link to={itemPath(item)} onClick={() => primed.set(item.id, item)}>
                <h2 className="font-display text-[28px] font-bold leading-[1.05] text-white sm:text-4xl lg:text-5xl">{truncate(item.title, 90)}</h2>
              </Link>
              {item.description && <p className="mt-2 line-clamp-2 max-w-xl text-[14px] leading-relaxed text-white/75 sm:text-[15px]">{item.description}</p>}
              <div className="mt-1.5 text-[12px] text-white/55">{[item.sourceName, formatDate(item.date, settings.language)].filter(Boolean).join(' · ')}</div>
              <div className="mt-4 flex items-center gap-2.5">
                <Link
                  to={itemPath(item)}
                  onClick={() => primed.set(item.id, item)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-black transition active:scale-95"
                >
                  {t('details')}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
                <SaveButton item={item} className="!h-11 !w-11" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {count > 1 && (
          <div className="absolute end-5 top-5 flex gap-1.5 sm:end-7 sm:top-7">
            {items.map((x, i) => (
              <button
                key={x.id}
                aria-label={`${i + 1} / ${count}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className="relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all"
                style={{ width: i === index ? 28 : 8 }}
              >
                {i === index && !paused && (
                  <motion.span key={index} className="absolute inset-y-0 start-0 bg-white" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: interval / 1000, ease: 'linear' }} />
                )}
                {i === index && paused && <span className="absolute inset-0 bg-white" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function Rail({ title, subtitle, to, children, icon, action }: { title: string; subtitle?: ReactNode; to?: string; children: ReactNode; icon?: React.ComponentProps<typeof SectionHeader>['icon']; action?: ReactNode }) {
  return (
    <section className="mt-8">
      <SectionHeader title={title} subtitle={subtitle} to={to} icon={icon} action={action} />
      {children}
    </section>
  );
}

/* ---------- Trailers ---------- */

export function TrailerPlayer({ trailer, onClose }: { trailer: Trailer | null; onClose: () => void }) {
  const { t } = useSettings();
  return (
    <Sheet open={!!trailer} onClose={onClose} title={trailer?.name ?? t('trailer')} wide>
      {trailer && (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&playsinline=1&rel=0`}
            title={trailer.name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      <p className="mt-3 text-[12px] text-faint">{t('trailer_note')}</p>
    </Sheet>
  );
}

export function TrailerCard({ trailer, item, onPlay }: { trailer: Trailer; item?: ContentItem; onPlay: () => void }) {
  return (
    <button onClick={onPlay} className="group relative block w-[78vw] max-w-[320px] text-start sm:w-[300px]">
      <div className="relative aspect-video overflow-hidden rounded-3xl border hairline">
        <img src={`https://i.ytimg.com/vi/${trailer.key}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-xl transition group-active:scale-90">
          <Play className="ms-0.5 h-6 w-6 fill-black" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <div className="truncate text-[15px] font-semibold text-white">{item?.title ?? trailer.name}</div>
          <div className="truncate text-[12px] text-white/65">{trailer.name}</div>
        </div>
      </div>
    </button>
  );
}

export function CloseFab({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className={cx('flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md', className)}>
      <X className="h-5 w-5" />
    </button>
  );
}
