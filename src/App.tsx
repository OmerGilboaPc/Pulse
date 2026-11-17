import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Compass, RefreshCw } from 'lucide-react';
import { SettingsProvider, useSettings } from './store/settings';
import { ToastProvider, useToast } from './components/ui/overlays';
import { AppShell, Logo } from './components/layout/Shell';
import { EmptyState } from './components/ui/primitives';
import { checkReminders } from './lib/notify';
import { pruneStorage } from './lib/db';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';

const Discover = lazy(() => import('./pages/Discover'));
const DiscoverCategory = lazy(() => import('./pages/Discover').then((m) => ({ default: m.DiscoverCategory })));
const Trending = lazy(() => import('./pages/Trending'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Search = lazy(() => import('./pages/Search'));
const Detail = lazy(() => import('./pages/Detail'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Preferences = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Preferences })));
const Integrations = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Integrations })));
const Sources = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Sources })));
const DataPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.DataPage })));
const HistoryPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.HistoryPage })));
const InstallPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.InstallPage })));
const AboutPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.AboutPage })));

function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Logo />
      </motion.div>
    </div>
  );
}

function NotFound() {
  const { t } = useSettings();
  return (
    <div className="pt-safe">
      <EmptyState
        icon={Compass}
        title={t('nf_title')}
        body={t('nf_body')}
        action={
          <Link to="/" className="inline-flex h-11 items-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent">
            {t('nav_home')}
          </Link>
        }
        className="min-h-[70dvh]"
      />
    </div>
  );
}

/** Scroll to top on new pages, restore position on back/forward. */
function ScrollManager() {
  const location = useLocation();
  const type = useNavigationType();
  const positions = useRef(new Map<string, number>());
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => {
    const key = location.key;
    const saved = positions.current.get(key);
    requestAnimationFrame(() => window.scrollTo({ top: type === 'POP' && saved !== undefined ? saved : 0 }));
    return () => {
      positions.current.set(key, window.scrollY);
    };
  }, [location.key, type]);
  return null;
}

function UpdatePrompt() {
  const { t } = useSettings();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Check for a new deployment hourly and whenever the app returns to the foreground.
      setInterval(() => void reg.update().catch(() => undefined), 60 * 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[75] flex justify-center px-4 pt-[max(12px,var(--safe-top))]">
      <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex w-full max-w-sm items-center gap-3 rounded-2xl border hairline bg-elevated/95 p-3 ps-4 shadow-2xl backdrop-blur-xl">
        <RefreshCw className="h-5 w-5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{t('update_available')}</div>
        <button onClick={() => setNeedRefresh(false)} className="px-2 text-[13px] font-semibold text-muted">
          {t('later')}
        </button>
        <button onClick={() => void updateServiceWorker(true)} className="rounded-full bg-accent-gradient px-3.5 py-1.5 text-[13px] font-semibold text-on-accent">
          {t('reload')}
        </button>
      </motion.div>
    </div>
  );
}

function ReminderWatcher() {
  const { settings, t } = useSettings();
  const toast = useToast();
  const latest = useRef(settings);
  latest.current = settings;
  useEffect(() => {
    const run = async () => {
      const due = await checkReminders(latest.current, {
        release: t('notif_release_body'),
        saved: (n) => t('notif_digest_title', { n }),
        savedBody: t('notif_digest_body'),
      });
      for (const d of due) toast({ message: `🔔 ${d.title}` });
    };
    void run();
    const id = setInterval(run, 30_000);
    const onVis = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [t, toast]);
  return null;
}

function Routed() {
  const { settings } = useSettings();
  const location = useLocation();
  useEffect(() => {
    void pruneStorage();
  }, []);
  if (!settings.onboarded) return <Onboarding />;
  return (
    <AppShell>
      <ScrollManager />
      <ReminderWatcher />
      <Suspense fallback={<div className="min-h-[60dvh]" />}>
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/discover/:category" element={<DiscoverCategory />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/search" element={<Search />} />
            <Route path="/item/:id" element={<Detail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/preferences" element={<Preferences />} />
            <Route path="/profile/integrations" element={<Integrations />} />
            <Route path="/profile/sources" element={<Sources />} />
            <Route path="/profile/notifications" element={<Notifications />} />
            <Route path="/profile/data" element={<DataPage />} />
            <Route path="/profile/history" element={<HistoryPage />} />
            <Route path="/profile/install" element={<InstallPage />} />
            <Route path="/profile/about" element={<AboutPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </Suspense>
      <UpdatePrompt />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <SettingsProvider fallback={<Splash />}>
        <ToastProvider>
          <Routed />
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
