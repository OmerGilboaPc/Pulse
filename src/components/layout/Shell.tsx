import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bookmark, CalendarDays, ChevronLeft, Compass, Flame, House, Search, Settings2, User, WifiOff } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { db } from '../../lib/db';
import { cx } from '../ui/primitives';
import type { TKey } from '../../lib/messages';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)} dir="ltr">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient shadow-glow">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M3 17h6l3-8 5 15 4-11 2 4h6" stroke="rgb(var(--on-accent))" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="font-display text-[19px] font-bold tracking-[0.18em] text-ink">PULSE</span>}
    </span>
  );
}

const NAV: { to: string; label: TKey; icon: typeof House; end?: boolean }[] = [
  { to: '/', label: 'nav_home', icon: House, end: true },
  { to: '/discover', label: 'nav_discover', icon: Compass },
  { to: '/trending', label: 'nav_trending', icon: Flame },
  { to: '/watchlist', label: 'nav_watchlist', icon: Bookmark },
  { to: '/profile', label: 'nav_profile', icon: User },
];

function BottomNav() {
  const { t } = useSettings();
  const { pathname } = useLocation();
  const isActive = (to: string, end?: boolean) => (end ? pathname === to : pathname.startsWith(to));
  return (
    <nav
      aria-label={t('nav_main')}
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      <div className="glass border-t hairline pb-safe">
        <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch justify-around px-1">
          {NAV.map((n) => {
            const active = isActive(n.to, n.end);
            return (
              <li key={n.to} className="flex-1">
                <NavLink
                  to={n.to}
                  end={n.end}
                  aria-current={active ? 'page' : undefined}
                  className={cx('relative flex h-full flex-col items-center justify-center gap-1 transition active:scale-95', active ? 'text-accent-ink' : 'text-muted')}
                >
                  {active && <motion.span layoutId="nav-pill" className="absolute top-1.5 h-8 w-14 rounded-full bg-accent/14 bg-accent/15" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <n.icon className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                  <span className="relative text-[10.5px] font-semibold tracking-wide">{t(n.label)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function Sidebar() {
  const { t, settings } = useSettings();
  const count = useLiveQuery(() => db.watchlist.count(), []) ?? 0;
  const extra = [
    { to: '/calendar', label: 'nav_calendar' as TKey, icon: CalendarDays },
    { to: '/profile/preferences', label: 'nav_settings' as TKey, icon: Settings2 },
  ];
  const link = (n: { to: string; label: TKey; icon: typeof House; end?: boolean }) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        cx('group relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-semibold transition', isActive ? 'bg-accent/12 bg-elevated text-ink' : 'text-muted hover:bg-elevated/60 hover:text-ink')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="side-pill" className="absolute inset-y-2 start-0 w-1 rounded-full bg-accent" />}
          <n.icon className={cx('h-5 w-5', isActive && 'text-accent-ink')} strokeWidth={2.1} />
          <span className="flex-1">{t(n.label)}</span>
          {n.to === '/watchlist' && count > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-ink">{count}</span>}
        </>
      )}
    </NavLink>
  );
  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e hairline bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link to="/" className="mb-8 px-2">
        <Logo />
      </Link>
      <Link
        to="/search"
        className="mb-6 flex h-11 items-center gap-2.5 rounded-2xl border hairline bg-elevated/70 px-3.5 text-[14px] text-faint transition hover:border-accent/40 hover:text-muted"
      >
        <Search className="h-[18px] w-[18px]" />
        <span className="flex-1">{t('search_placeholder')}</span>
        <kbd className="rounded-md border hairline px-1.5 text-[11px] font-semibold">/</kbd>
      </Link>
      <nav aria-label={t('nav_main')} className="space-y-1">
        {NAV.map(link)}
      </nav>
      <div className="my-5 border-t hairline" />
      <nav className="space-y-1">{extra.map(link)}</nav>
      <div className="mt-auto px-2 text-[12px] leading-relaxed text-faint">
        <div className="font-display font-semibold tracking-[0.2em] text-muted">PULSE</div>
        {t('tagline')}
        {settings.name && <div className="mt-1 text-muted">{t('signedInAs', { name: settings.name })}</div>}
      </div>
    </aside>
  );
}

export function SearchFab({ className }: { className?: string }) {
  const { t } = useSettings();
  return (
    <Link
      to="/search"
      aria-label={t('nav_search')}
      className={cx('tap-target relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-gradient text-on-accent shadow-glow transition active:scale-90 lg:hidden', className)}
    >
      <Search className="h-[19px] w-[19px]" strokeWidth={2.5} />
    </Link>
  );
}

/** Sticky, translucent page header that respects the notch / status bar. */
export function PageHeader({ title, back, right, large = true, subtitle }: { title: string; back?: boolean | string; right?: ReactNode; large?: boolean; subtitle?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/');
  };
  return (
    <>
      <header className={cx('sticky top-0 z-30 pt-safe transition-colors', scrolled ? 'glass border-b hairline' : 'bg-transparent')}>
        <div className="page-x flex h-14 items-center gap-2">
          {back && (
            <button onClick={goBack} aria-label={t('back')} className="tap-target -ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-elevated">
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
          )}
          <div className={cx('min-w-0 flex-1 transition-opacity', large && !scrolled ? 'opacity-0' : 'opacity-100')}>
            <div className="truncate text-[17px] font-semibold text-ink">{title}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            <SearchFab />
          </div>
        </div>
      </header>
      {large && (
        <div className="page-x pb-4 pt-1">
          <h1 className="text-[32px] font-bold leading-tight text-ink lg:text-[40px]">{title}</h1>
          {subtitle && <div className="mt-1 text-[14px] text-muted">{subtitle}</div>}
        </div>
      )}
    </>
  );
}

function OfflineBanner() {
  const { t } = useSettings();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center pt-safe">
      <div className="mt-2 flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-200 backdrop-blur-xl">
        <WifiOff className="h-3.5 w-3.5" />
        {t('offline_banner')}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
  return (
    <div className="relative min-h-[100dvh]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--accent)/0.10),transparent_70%)]" />
      <OfflineBanner />
      <Sidebar />
      <main
        className="relative pb-nav lg:ms-[264px] lg:pb-12"
        style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
