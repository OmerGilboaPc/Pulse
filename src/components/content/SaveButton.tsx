import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { db } from '../../lib/db';
import type { ContentItem } from '../../lib/types';
import { removeItem, restoreEntry, saveItem } from '../../lib/actions';
import { useSettings } from '../../store/settings';
import { useToast } from '../ui/overlays';
import { cx } from '../ui/primitives';

export function useIsSaved(id: string) {
  return useLiveQuery(async () => !!(await db.watchlist.get(id)), [id]) ?? false;
}

export function useToggleSave() {
  const { settings, t } = useSettings();
  const toast = useToast();
  return async (item: ContentItem, saved: boolean) => {
    if (saved) {
      const entry = await removeItem(item.id);
      toast({
        message: t('toast_removed'),
        action: entry ? { label: t('undo'), run: () => void restoreEntry(entry) } : undefined,
      });
    } else {
      await saveItem(item, settings);
      if (navigator.vibrate) navigator.vibrate(8);
      toast({ message: t('toast_saved'), tone: 'success' });
    }
  };
}

export function SaveButton({ item, variant = 'overlay', className }: { item: ContentItem; variant?: 'overlay' | 'plain' | 'full'; className?: string }) {
  const saved = useIsSaved(item.id);
  const toggle = useToggleSave();
  const { t } = useSettings();
  const label = saved ? t('saved') : t('save');
  const Icon = saved ? BookmarkCheck : Bookmark;

  if (variant === 'full') {
    return (
      <button
        onClick={() => void toggle(item, saved)}
        aria-pressed={saved}
        className={cx(
          'inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition active:scale-[0.97]',
          saved ? 'border hairline bg-elevated text-ink' : 'bg-accent-gradient text-on-accent shadow-glow',
          className,
        )}
      >
        <motion.span key={String(saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </motion.span>
        {saved ? t('inWatchlist') : t('addToWatchlist')}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(item, saved);
      }}
      aria-label={label}
      aria-pressed={saved}
      title={label}
      className={cx(
        'tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90',
        variant === 'overlay' && (saved ? 'bg-accent text-on-accent' : 'bg-black/45 text-white backdrop-blur-md hover:bg-black/60'),
        variant === 'plain' && (saved ? 'bg-accent/15 text-accent-ink' : 'bg-elevated text-muted hover:text-ink border hairline'),
        className,
      )}
    >
      <motion.span key={String(saved)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.3} />
      </motion.span>
    </button>
  );
}
