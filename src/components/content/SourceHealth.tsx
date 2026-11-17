import { useState } from 'react';
import { CircleCheck, CircleAlert, Activity } from 'lucide-react';
import type { SourceStatus } from '../../lib/types';
import { useSettings } from '../../store/settings';
import { Sheet } from '../ui/overlays';
import { Link } from 'react-router-dom';

export function SourceHealth({ sources }: { sources?: SourceStatus[] }) {
  const { t, tx } = useSettings();
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  const ok = sources.filter((s) => s.ok).length;
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-faint hover:text-muted">
        <Activity className="h-3.5 w-3.5" />
        {t('sources_count', { ok, total: sources.length })}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('sources_title')}>
        <p className="mb-3 text-[13px] leading-relaxed text-muted">{t('sources_body')}</p>
        <ul className="divide-y divide-white/5 rounded-2xl border hairline bg-elevated/40">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              {s.ok ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-400" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{s.name}</span>
                <span className="block text-[12px] text-muted">
                  {s.ok ? t('sources_items', { n: s.count }) : tx(`errkind_${s.error}`, t('err_title'))}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <Link to="/profile/sources" onClick={() => setOpen(false)} className="mt-4 inline-block text-[13px] font-semibold text-accent-ink">
          {t('sources_manage')}
        </Link>
      </Sheet>
    </>
  );
}
