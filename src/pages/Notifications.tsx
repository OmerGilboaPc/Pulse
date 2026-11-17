import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, BellOff, BellPlus, CalendarPlus, CircleAlert, Info, Smartphone, Trash2 } from 'lucide-react';
import { db, type Reminder } from '../lib/db';
import { buildIcs, createReminder, deleteReminder, downloadFile, safeFileName, validateReminder, type ReminderError } from '../lib/actions';
import { isIOS, isStandalone, notificationSupport, permission, requestPermission, showNotification } from '../lib/notify';
import { useSettings } from '../store/settings';
import type { ContentItem } from '../lib/types';
import { formatDateTime, ymd } from '../lib/format';
import { PageHeader } from '../components/layout/Shell';
import { Sheet, useToast } from '../components/ui/overlays';
import { Button, Card, cx, EmptyState, FieldError, Toggle } from '../components/ui/primitives';
import type { TKey } from '../lib/messages';

const ERR: Record<ReminderError, TKey> = {
  titleRequired: 'rem_err_title',
  titleTooLong: 'rem_err_title_long',
  dateRequired: 'rem_err_date',
  dateInPast: 'rem_err_past',
  noteTooLong: 'rem_err_note',
};

export function ReminderForm({ item, onDone }: { item?: ContentItem; onDone: () => void }) {
  const { t, settings } = useSettings();
  const toast = useToast();
  const tomorrow = new Date(Date.now() + 864e5);
  const [title, setTitle] = useState(item?.title ?? '');
  const [date, setDate] = useState(ymd(tomorrow));
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [error, setError] = useState<ReminderError | null>(null);

  const at = (() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const ts = new Date(y, m - 1, d, hh, mm).getTime();
    return Number.isNaN(ts) ? null : ts;
  })();

  const field = (e: ReminderError[]) => (error && e.includes(error) ? t(ERR[error]) : undefined);

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const err = validateReminder(title, at, note);
        setError(err);
        if (err || !at) return;
        await createReminder({ title, at, note, item, type: item ? 'saved' : 'custom' });
        if (permission() === 'default') await requestPermission();
        toast({ message: t('rem_created', { when: formatDateTime(at, settings.language) }), tone: 'success' });
        onDone();
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="rem-title" className="mb-1.5 block text-[13px] font-semibold text-muted">
          {t('rem_title')}
        </label>
        <input id="rem-title" className="input" value={title} maxLength={100} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder={t('rem_title_placeholder')} aria-invalid={!!field(['titleRequired', 'titleTooLong'])} />
        <FieldError>{field(['titleRequired', 'titleTooLong'])}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rem-date" className="mb-1.5 block text-[13px] font-semibold text-muted">
            {t('rem_date')}
          </label>
          <input id="rem-date" type="date" className="input" value={date} min={ymd(new Date())} onChange={(e) => { setDate(e.target.value); setError(null); }} aria-invalid={!!field(['dateRequired', 'dateInPast'])} />
        </div>
        <div>
          <label htmlFor="rem-time" className="mb-1.5 block text-[13px] font-semibold text-muted">
            {t('rem_time')}
          </label>
          <input id="rem-time" type="time" className="input" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} />
        </div>
      </div>
      <FieldError>{field(['dateRequired', 'dateInPast'])}</FieldError>
      <div>
        <label htmlFor="rem-note" className="mb-1.5 block text-[13px] font-semibold text-muted">
          {t('rem_note')}
        </label>
        <textarea id="rem-note" className="input min-h-[72px]" value={note} maxLength={320} onChange={(e) => { setNote(e.target.value); setError(null); }} />
        <div className="mt-1 flex justify-between">
          <FieldError>{field(['noteTooLong'])}</FieldError>
          <span className={cx('ms-auto text-[12px] tabular-nums', note.length > 300 ? 'text-rose-400' : 'text-faint')}>{note.length}/300</span>
        </div>
      </div>
      <Button type="submit" variant="primary" icon={BellPlus} className="w-full">
        {t('rem_save')}
      </Button>
    </form>
  );
}

function exportIcs(r: Reminder) {
  const ics = buildIcs([{ uid: r.id, title: r.title, start: r.at, description: r.note ?? r.item?.description, url: r.item?.url }]);
  downloadFile(`${safeFileName(r.title)}.ics`, ics, 'text/calendar');
}

function ReminderRow({ r }: { r: Reminder }) {
  const { t, settings } = useSettings();
  const typeLabel: Record<Reminder['type'], TKey> = { release: 'rem_type_release', saved: 'rem_type_saved', custom: 'rem_type_custom' };
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', r.fired ? 'bg-elevated text-faint' : 'bg-accent/15 text-accent-ink')}>
        <Bell className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        {r.itemId ? (
          <Link to={`/item/${encodeURIComponent(r.itemId)}`} className="block truncate text-[15px] font-medium text-ink hover:underline">
            {r.title}
          </Link>
        ) : (
          <div className="truncate text-[15px] font-medium text-ink">{r.title}</div>
        )}
        <div className="truncate text-[12.5px] text-muted">
          {t(typeLabel[r.type])} · {formatDateTime(r.at, settings.language)}
          {r.note ? ` · ${r.note}` : ''}
        </div>
      </div>
      <button aria-label={t('rem_ics')} title={t('rem_ics')} onClick={() => exportIcs(r)} className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-muted hover:text-ink">
        <CalendarPlus className="h-4 w-4" />
      </button>
      <button aria-label={t('delete')} title={t('delete')} onClick={() => void deleteReminder(r.id)} className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-muted hover:text-rose-400">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function Notifications() {
  const { t, settings, update } = useSettings();
  const toast = useToast();
  const [perm, setPerm] = useState(permission());
  const [creating, setCreating] = useState(false);
  const reminders = useLiveQuery(() => db.reminders.orderBy('at').toArray(), []) ?? [];
  const upcoming = reminders.filter((r) => !r.fired);
  const past = reminders.filter((r) => r.fired).reverse().slice(0, 10);
  const support = notificationSupport();
  const n = settings.notifications;
  const setN = (patch: Partial<typeof n>) => update((s) => ({ notifications: { ...s.notifications, ...patch } }));

  const enable = async (v: boolean) => {
    if (!v) return setN({ enabled: false });
    const p = await requestPermission();
    setPerm(p);
    if (p === 'granted') {
      await setN({ enabled: true });
      toast({ message: t('notif_enabled'), tone: 'success' });
    } else {
      toast({ message: p === 'denied' ? t('notif_denied') : t('notif_unsupported'), tone: 'error' });
    }
  };

  return (
    <div>
      <PageHeader title={t('notif_title')} back="/profile" />
      <div className="page-x space-y-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            {support === 'supported' && perm === 'granted' ? <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />}
            <div className="text-[13.5px] leading-relaxed text-muted">
              <div className="font-semibold text-ink">
                {support === 'needs-install' ? t('notif_ios_install') : support === 'unsupported' ? t('notif_unsupported') : perm === 'granted' ? t('notif_granted') : perm === 'denied' ? t('notif_denied') : t('notif_default')}
              </div>
              <p className="mt-1">{t('notif_how')}</p>
              {isIOS() && (
                <p className="mt-2 flex items-start gap-1.5">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {isStandalone() ? t('notif_ios_standalone') : t('notif_ios_note')}{' '}
                    {!isStandalone() && (
                      <Link to="/profile/install" className="font-semibold text-accent-ink">
                        {t('install_how')}
                      </Link>
                    )}
                  </span>
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="divide-y divide-line/[0.07] px-4">
          <Toggle label={t('notif_enable')} description={t('notif_enable_desc')} checked={n.enabled && perm === 'granted'} disabled={support !== 'supported'} onChange={enable} />
          <Toggle label={t('notif_release')} description={t('notif_release_desc')} checked={n.releaseReminders} onChange={(v) => setN({ releaseReminders: v })} />
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-[15px] font-medium text-ink">{t('notif_lead')}</span>
            <select value={n.releaseLeadDays} onChange={(e) => setN({ releaseLeadDays: Number(e.target.value) })} className="rounded-full border hairline bg-elevated px-3 py-1.5 text-[14px] font-semibold text-ink outline-none">
              <option value={0}>{t('notif_lead_0')}</option>
              <option value={1}>{t('notif_lead_1')}</option>
              <option value={7}>{t('notif_lead_7')}</option>
            </select>
          </div>
          <Toggle label={t('notif_digest')} description={t('notif_digest_desc')} checked={n.savedDigest} onChange={(v) => setN({ savedDigest: v })} />
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={BellPlus} onClick={() => setCreating(true)}>
            {t('rem_new')}
          </Button>
          <Button
            icon={Bell}
            disabled={perm !== 'granted'}
            onClick={async () => {
              const ok = await showNotification('PULSE', t('notif_test_body'), `${import.meta.env.BASE_URL}profile/notifications`, 'pulse-test');
              toast({ message: ok ? t('notif_test_sent') : t('notif_unsupported'), tone: ok ? 'success' : 'error' });
            }}
          >
            {t('notif_test')}
          </Button>
        </div>

        <section>
          <h2 className="mb-2 mt-4 text-[17px] font-semibold text-ink">{t('rem_upcoming')}</h2>
          {upcoming.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line/[0.07]">
                {upcoming.map((r) => (
                  <ReminderRow key={r.id} r={r} />
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState icon={Bell} title={t('rem_none')} body={t('rem_none_body')} className="!py-8" />
          )}
        </section>
        {past.length > 0 && (
          <section>
            <h2 className="mb-2 mt-2 text-[15px] font-semibold text-muted">{t('rem_past')}</h2>
            <Card className="overflow-hidden opacity-80">
              <ul className="divide-y divide-line/[0.07]">
                {past.map((r) => (
                  <ReminderRow key={r.id} r={r} />
                ))}
              </ul>
            </Card>
          </section>
        )}
        <p className="flex items-start gap-2 pb-4 text-[12.5px] leading-relaxed text-faint">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {t('notif_limits')}
        </p>
        {support === 'unsupported' && (
          <p className="flex items-start gap-2 text-[12.5px] text-amber-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {t('notif_ics_hint')}
          </p>
        )}
      </div>
      <Sheet open={creating} onClose={() => setCreating(false)} title={t('rem_new')}>
        <ReminderForm onDone={() => setCreating(false)} />
      </Sheet>
    </div>
  );
}
