import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarDays, Compass } from 'lucide-react';
import { useSettings } from '../store/settings';
import { DISCOVER_SECTIONS } from '../lib/catalog';
import { PageHeader } from '../components/layout/Shell';
import { EmptyState } from '../components/ui/primitives';
import MoviesTv from './discover/MoviesTv';
import Games from './discover/Games';
import Sports from './discover/Sports';
import Tech from './discover/Tech';
import World from './discover/World';

export default function Discover() {
  const { settings, t } = useSettings();
  const sections = DISCOVER_SECTIONS.filter((d) => d.categories.some((c) => settings.enabledCategories.includes(c)));
  return (
    <div>
      <PageHeader title={t('nav_discover')} subtitle={t('disc_sub')} />
      {sections.length === 0 ? (
        <EmptyState icon={Compass} title={t('disc_none')} body={t('disc_none_body')} action={<Link className="font-semibold text-accent-ink" to="/profile/preferences">{t('nav_settings')}</Link>} />
      ) : (
        <div className="page-x grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((d, i) => (
            <motion.div key={d.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }} className={i === 0 ? 'sm:col-span-2 xl:col-span-1' : ''}>
              <Link
                to={`/discover/${d.slug}`}
                className="noise group relative flex h-[150px] overflow-hidden rounded-[28px] border hairline p-5 transition active:scale-[0.98] sm:h-[190px]"
                style={{
                  background: `radial-gradient(120% 120% at 100% 0%, hsl(${d.hue} 85% 55% / 0.45) 0%, transparent 55%), radial-gradient(80% 90% at 0% 100%, hsl(${d.hue + 50} 80% 45% / 0.35) 0%, transparent 60%), linear-gradient(160deg, hsl(${d.hue} 30% 12%), #06080b)`,
                }}
              >
                <d.icon className="absolute -bottom-6 -end-4 h-40 w-40 text-white/[0.08] transition duration-700 group-hover:scale-110 group-hover:-rotate-6" strokeWidth={1.2} />
                <div className="relative flex flex-1 flex-col justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 backdrop-blur-md">
                    <d.icon className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 font-display text-2xl font-bold text-white">
                      {t(d.label)}
                      <ArrowUpRight className="h-5 w-5 opacity-60 transition group-hover:opacity-100 rtl:-scale-x-100" />
                    </div>
                    <div className="mt-0.5 text-[13px] text-white/70">{t(d.blurb)}</div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
          <Link to="/calendar" className="group relative flex h-[110px] items-center gap-4 overflow-hidden rounded-[28px] border hairline bg-surface p-5 transition active:scale-[0.98] sm:col-span-2 xl:col-span-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-on-accent shadow-glow">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl font-bold text-ink">{t('nav_calendar')}</div>
              <div className="text-[13px] text-muted">{t('disc_calendar_blurb')}</div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted rtl:-scale-x-100" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function DiscoverCategory() {
  const { category } = useParams();
  switch (category) {
    case 'movies-tv':
    case 'movies':
    case 'tv':
      return <MoviesTv initialTab={category === 'tv' ? 'tv' : 'movies'} />;
    case 'games':
      return <Games />;
    case 'sports':
      return <Sports />;
    case 'tech':
      return <Tech />;
    case 'world':
      return <World />;
    default:
      return <Navigate to="/discover" replace />;
  }
}
