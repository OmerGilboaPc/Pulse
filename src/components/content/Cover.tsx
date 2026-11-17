import { useState } from 'react';
import type { ContentItem } from '../../lib/types';
import { CATEGORY_META } from '../../lib/catalog';
import { hashString, hostnameOf } from '../../lib/format';
import { cx } from '../ui/primitives';

/** Generative cover art for items without imagery — deterministic per title. */
export function ArtCover({ item, className, showTitle = true, size = 'md' }: { item: ContentItem; className?: string; showTitle?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const meta = CATEGORY_META[item.category];
  const h = hashString(item.id + item.title);
  const hue = (meta.hue + (h % 50) - 25 + 360) % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  const x = 15 + (h % 60);
  const y = 10 + ((h >> 4) % 50);
  const Icon = meta.icon;
  const host = hostnameOf(item.url);
  return (
    <div
      className={cx('noise relative h-full w-full overflow-hidden', className)}
      style={{
        background: `radial-gradient(120% 90% at ${x}% ${y}%, hsl(${hue} 85% 55% / 0.55) 0%, transparent 55%), radial-gradient(90% 80% at ${100 - x}% ${100 - y / 2}%, hsl(${hue2} 80% 45% / 0.45) 0%, transparent 60%), linear-gradient(160deg, hsl(${hue} 35% 12%) 0%, #07090c 100%)`,
      }}
      aria-hidden
    >
      <Icon className={cx('absolute text-white/[0.09]', size === 'sm' ? '-bottom-3 -end-3 h-16 w-16' : '-bottom-6 -end-6 h-36 w-36')} strokeWidth={1.2} />
      {showTitle && (
        <div className={cx('absolute inset-0 flex flex-col justify-end', size === 'sm' ? 'p-2.5' : 'p-4')}>
          {host && size !== 'sm' && <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{host}</span>}
          <span className={cx('font-display font-semibold leading-tight text-white/90', size === 'sm' ? 'text-[11px] line-clamp-3' : size === 'lg' ? 'text-2xl line-clamp-3' : 'text-base line-clamp-3')}>
            {item.title}
          </span>
        </div>
      )}
    </div>
  );
}

export function Cover({
  item,
  variant = 'wide',
  className,
  sizes,
  showArtTitle = true,
  eager,
}: {
  item: ContentItem;
  variant?: 'wide' | 'poster';
  className?: string;
  sizes?: 'sm' | 'md' | 'lg';
  showArtTitle?: boolean;
  eager?: boolean;
}) {
  const src = variant === 'poster' ? item.poster ?? item.image : item.image ?? item.poster;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || failed) return <ArtCover item={item} className={className} size={sizes} showTitle={showArtTitle} />;
  return (
    <div className={cx('relative h-full w-full overflow-hidden bg-elevated', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-elevated" />}
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx('h-full w-full object-cover transition duration-700', loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0')}
      />
    </div>
  );
}
