import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { cx } from './primitives';
import { useSettings } from '../../store/settings';

/* ---------------- Sheet (bottom sheet on mobile, dialog on desktop) ---------------- */

export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useSettings();
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => panel.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cx(
              'relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-t hairline bg-surface shadow-2xl outline-none lg:rounded-[28px] lg:border',
              wide ? 'lg:max-w-2xl' : 'lg:max-w-lg',
            )}
          >
            <div className="flex touch-none justify-center pb-1 pt-2.5 lg:hidden" onPointerDown={(e) => controls.start(e)}>
              <span className="h-1.5 w-10 rounded-full bg-faint/40" />
            </div>
            {title && (
              <div className="flex touch-none items-center justify-between gap-3 px-5 pb-2 pt-2 lg:pt-5" onPointerDown={(e) => controls.start(e)}>
                <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
                <button onClick={onClose} aria-label={t('close')} className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-muted hover:text-ink">
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {children}
            </div>
            {footer && <div className="border-t hairline px-5 py-3 pb-[max(12px,var(--safe-bottom))]">{footer}</div>}
            {!footer && <div className="pb-[var(--safe-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------------- Toasts ---------------- */

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  tone?: 'default' | 'success' | 'error';
}

const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), t.action ? 5500 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--nav-h)+var(--safe-bottom)+16px)] lg:bottom-6"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border hairline bg-elevated/95 px-4 py-3 text-sm text-ink shadow-2xl backdrop-blur-xl"
            >
              <span className={cx('h-2 w-2 shrink-0 rounded-full', t.tone === 'error' ? 'bg-rose-400' : t.tone === 'success' ? 'bg-emerald-400' : 'bg-accent')} />
              <span className="min-w-0 flex-1 font-medium">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.run();
                    setToasts((s) => s.filter((x) => x.id !== t.id));
                  }}
                  className="shrink-0 font-semibold text-accent-ink"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Confirm dialog ---------------- */

export function ConfirmSheet({ open, title, body, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; body?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useSettings();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="text-[15px] leading-relaxed text-muted">{body}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className="h-12 flex-1 rounded-full border hairline bg-elevated font-semibold text-ink">
          {t('cancel')}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cx('h-12 flex-1 rounded-full font-semibold', danger ? 'bg-rose-500 text-white' : 'bg-accent-gradient text-on-accent')}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
