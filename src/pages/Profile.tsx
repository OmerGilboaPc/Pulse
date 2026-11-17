import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, Database, History, Info, KeyRound, Palette, Pencil, Rss, Smartphone } from 'lucide-react';
import { db } from '../lib/db';
import { useSettings } from '../store/settings';
import { CATEGORY_META } from '../lib/catalog';
import { hasRawg, hasTmdb } from '../services/content';
import { PageHeader } from '../components/layout/Shell';
import { Sheet } from '../components/ui/overlays';
import { Button, Card, FieldError, ListRow } from '../components/ui/primitives';

export function NameForm({ onDone }: { onDone: () => void }) {
  const { settings, update, t } = useSettings();
  const [name, setName] = useState(settings.name);
  const [err, setErr] = useState('');
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (name.trim().length > 30) return setErr(t('name_err_long'));
        await update({ name: name.trim() });
        onDone();
      }}
    >
      <label htmlFor="name" className="mb-1.5 block text-[13px] font-semibold text-muted">
        {t('name_label')}
      </label>
      <input id="name" className="input" value={name} maxLength={40} autoFocus autoComplete="given-name" placeholder={t('name_placeholder')} onChange={(e) => { setName(e.target.value); setErr(''); }} />
      <FieldError>{err}</FieldError>
      <Button type="submit" variant="primary" className="mt-4 w-full">
        {t('save')}
      </Button>
    </form>
  );
}

export default function Profile() {
  const { settings, t } = useSettings();
  const [editing, setEditing] = useState(false);
  const counts = useLiveQuery(async () => {
    const [saved, done, collections, reminders] = await Promise.all([
      db.watchlist.count(),
      db.watchlist.where('status').equals('completed').count(),
      db.collections.count(),
      db.reminders.filter((r) => !r.fired).count(),
    ]);
    return { saved, done, collections, reminders };
  }, []);
  const initials = (settings.name.trim() || 'P').slice(0, 1).toUpperCase();
  const connected = [hasTmdb(settings) && 'TMDB', hasRawg(settings) && 'RAWG'].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader title={t('nav_profile')} large={false} />
      <div className="page-x">
        <div className="relative overflow-hidden rounded-[28px] border hairline bg-surface p-5">
          <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-accent-gradient font-display text-2xl font-bold text-on-accent shadow-glow">{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-2xl font-bold text-ink">{settings.name || t('profile_guest')}</div>
              <div className="truncate text-[13px] text-muted">{settings.favoriteCategories.map((c) => t(CATEGORY_META[c].label)).join(' · ') || t('profile_no_favs')}</div>
            </div>
            <button onClick={() => setEditing(true)} aria-label={t('name_edit')} className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-ink">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              [counts?.saved ?? 0, t('stat_saved')],
              [counts?.done ?? 0, t('stat_done')],
              [counts?.collections ?? 0, t('stat_collections')],
              [counts?.reminders ?? 0, t('stat_reminders')],
            ].map(([n, l]) => (
              <div key={String(l)} className="rounded-2xl bg-elevated/60 px-1 py-3">
                <div className="font-display text-xl font-bold tabular-nums text-ink">{n}</div>
                <div className="truncate text-[11px] font-medium text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="mb-2 mt-7 label-xs text-faint">{t('profile_personalize')}</h2>
        <Card className="divide-y divide-line/[0.07] overflow-hidden">
          <ListRow icon={Palette} title={t('pref_title')} subtitle={t('pref_sub')} to="/profile/preferences" />
          <ListRow icon={Bell} title={t('notif_title')} subtitle={settings.notifications.enabled ? t('on') : t('off')} to="/profile/notifications" />
        </Card>

        <h2 className="mb-2 mt-7 label-xs text-faint">{t('profile_content')}</h2>
        <Card className="divide-y divide-line/[0.07] overflow-hidden">
          <ListRow icon={KeyRound} title={t('int_title')} subtitle={connected || t('int_none')} to="/profile/integrations" />
          <ListRow icon={Rss} title={t('src_title')} subtitle={t('src_sub', { n: settings.rssFeeds.filter((f) => f.enabled).length })} to="/profile/sources" />
          <ListRow icon={History} title={t('hist_title')} subtitle={t('hist_sub')} to="/profile/history" />
        </Card>

        <h2 className="mb-2 mt-7 label-xs text-faint">{t('profile_app')}</h2>
        <Card className="divide-y divide-line/[0.07] overflow-hidden">
          <ListRow icon={Database} title={t('data_title')} subtitle={t('data_sub')} to="/profile/data" />
          <ListRow icon={Smartphone} title={t('install_title')} subtitle={t('install_sub')} to="/profile/install" />
          <ListRow icon={Info} title={t('about_title')} subtitle={`PULSE ${__APP_VERSION__}`} to="/profile/about" />
        </Card>
      </div>
      <Sheet open={editing} onClose={() => setEditing(false)} title={t('name_edit')}>
        <NameForm onDone={() => setEditing(false)} />
      </Sheet>
    </div>
  );
}
