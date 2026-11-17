import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, KeyRound, RefreshCw, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { isHttpError } from '../../services/http';
import { relativeTime } from '../../lib/format';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; size?: 'sm' | 'md' | 'lg' }>(
  function Button({ variant = 'secondary', icon: Icon, size = 'md', className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none',
          size === 'sm' && 'h-9 px-3.5 text-[13px]',
          size === 'md' && 'h-11 px-5 text-sm',
          size === 'lg' && 'h-12 px-6 text-[15px]',
          variant === 'primary' && 'bg-accent-gradient text-on-accent shadow-glow hover:brightness-110',
          variant === 'secondary' && 'bg-elevated text-ink border hairline hover:bg-elevated/70',
          variant === 'ghost' && 'text-ink hover:bg-elevated/70',
          variant === 'danger' && 'bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25',
          className,
        )}
        {...rest}
      >
        {Icon && <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />}
        {children}
      </button>
    );
  },
);

export function IconButton({
  icon: Icon,
  label,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'tap-target inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90',
        active ? 'bg-accent/15 text-accent-ink' : 'bg-elevated/80 text-ink hover:bg-elevated border hairline',
        className,
      )}
      {...rest}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
  icon: Icon,
  count,
  color,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  count?: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95 whitespace-nowrap',
        active ? 'text-on-accent' : 'bg-elevated/70 text-muted hover:text-ink border hairline',
      )}
    >
      {active && <span className="absolute inset-0 rounded-full bg-accent-gradient" />}
      <span className="relative inline-flex items-center gap-1.5">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />}
        {children}
        {typeof count === 'number' && <span className={cx('text-[11px] tabular-nums', active ? 'opacity-80' : 'text-faint')}>{count}</span>}
      </span>
    </button>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex gap-2 overflow-x-auto no-scrollbar px-4 lg:px-8 py-1', className)}>{children}</div>;
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cx('flex items-center justify-between gap-4 py-3', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-elevated border hairline')}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow', checked ? 'end-0.5' : 'start-0.5')}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: LucideIcon }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('inline-flex max-w-full overflow-x-auto no-scrollbar rounded-full bg-elevated/80 border hairline p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx('relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition', active ? 'text-ink' : 'text-muted hover:text-ink')}
          >
            {active && <motion.span layoutId={`seg-${options.map((x) => x.value).join('-')}`} className="absolute inset-0 rounded-full bg-surface shadow-card border hairline" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-1.5">
              {o.icon && <o.icon className="h-4 w-4" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-elevated/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

export function SectionHeader({ title, subtitle, to, action, icon: Icon }: { title: string; subtitle?: ReactNode; to?: string; action?: ReactNode; icon?: LucideIcon }) {
  const { t } = useSettings();
  return (
    <div className="page-x mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold leading-tight text-ink lg:text-[22px]">
          {Icon && <Icon className="h-5 w-5 text-accent-ink" strokeWidth={2.2} />}
          {title}
        </h2>
        {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
      </div>
      {action}
      {to && (
        <Link to={to} className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-accent-ink hover:opacity-80">
          {t('seeAll')}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border hairline bg-elevated">
          <Icon className="h-7 w-7 text-accent-ink" strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useSettings();
  const offline = (isHttpError(error) && error.kind === 'offline') || (typeof navigator !== 'undefined' && !navigator.onLine);
  const auth = isHttpError(error) && error.kind === 'auth';
  const title = offline ? t('err_offline_title') : auth ? t('err_auth_title') : t('err_title');
  const body = offline ? t('err_offline_body') : auth ? t('err_auth_body') : t('err_body');
  if (compact) {
    return (
      <div className="page-x">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          {offline ? <WifiOff className="h-5 w-5 shrink-0 text-amber-300" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-amber-300" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{title}</div>
            <div className="text-[13px] text-muted">{body}</div>
          </div>
          {onRetry && (
            <button onClick={onRetry} className="shrink-0 rounded-full bg-elevated px-3 py-1.5 text-[13px] font-semibold text-ink border hairline">
              {t('retry')}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <EmptyState
      icon={offline ? WifiOff : TriangleAlert}
      title={title}
      body={body}
      action={onRetry && <Button icon={RefreshCw} onClick={onRetry}>{t('retry')}</Button>}
    />
  );
}

export function NeedsKey({ service, compact }: { service: 'tmdb' | 'rawg'; compact?: boolean }) {
  const { t } = useSettings();
  const name = service === 'tmdb' ? 'TMDB' : 'RAWG';
  const what = service === 'tmdb' ? t('needsKey_tmdb') : t('needsKey_rawg');
  return (
    <div className="page-x">
      <div className={cx('relative overflow-hidden rounded-3xl border hairline bg-surface', compact ? 'p-4' : 'p-5')}>
        <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
            <KeyRound className="h-5 w-5 text-accent-ink" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">{t('needsKey_title', { name })}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{what}</p>
            <Link to="/profile/integrations" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-ink">
              {t('needsKey_cta', { name })}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Live · updated 4 min ago" / "Offline copy" indicator. */
export function Freshness({ updatedAt, stale, refreshing, onRefresh, sources }: { updatedAt?: number; stale?: boolean; refreshing?: boolean; onRefresh?: () => void; sources?: string }) {
  const { t, settings } = useSettings();
  if (!updatedAt) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[12px] text-faint">
      <span className={cx('h-1.5 w-1.5 rounded-full', stale ? 'bg-amber-400' : 'bg-emerald-400')} />
      {stale ? t('fresh_stale', { time: relativeTime(updatedAt, settings.language) }) : t('fresh_updated', { time: relativeTime(updatedAt, settings.language) })}
      {sources && <span className="text-faint/80">· {sources}</span>}
      {onRefresh && (
        <button onClick={onRefresh} aria-label={t('refresh')} className="tap-target ms-1 text-muted hover:text-ink">
          <RefreshCw className={cx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      )}
    </span>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'demo' | 'live' | 'warn'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]',
        tone === 'default' && 'bg-white/10 text-white backdrop-blur-md',
        tone === 'accent' && 'bg-accent/15 text-accent-ink',
        tone === 'demo' && 'bg-amber-400/90 text-black',
        tone === 'live' && 'bg-rose-500 text-white',
        tone === 'warn' && 'bg-amber-400/15 text-amber-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card', className)}>{children}</div>;
}

export function ListRow({ icon: Icon, title, subtitle, to, onClick, right, danger }: { icon?: LucideIcon; title: string; subtitle?: string; to?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  const inner = (
    <>
      {Icon && (
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-rose-500/15 text-rose-400' : 'bg-accent/12 text-accent-ink bg-elevated')}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1 text-start">
        <span className={cx('block truncate text-[15px] font-medium', danger ? 'text-rose-400' : 'text-ink')}>{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      {right}
      {(to || onClick) && !right && <ChevronRight className="h-4 w-4 shrink-0 text-faint rtl:rotate-180" />}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 transition hover:bg-elevated/50 active:bg-elevated/70';
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-[13px] font-medium text-rose-400">{children}</p>;
}
