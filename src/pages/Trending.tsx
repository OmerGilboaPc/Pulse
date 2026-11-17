import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, Info } from 'lucide-react';
import { useSettings } from '../store/settings';
import { useQuery } from '../hooks/useQuery';
import { settingsSig } from '../lib/actions';
import { trending, type SectionState, type TrendingData } from '../services/content';
import { PageHeader } from '../components/layout/Shell';
import { Cover } from '../components/content/Cover';
import { CategoryLabel, itemPath, ListSkeleton, PopularityLine, primed, RankCard } from '../components/content/Cards';
import { SaveButton } from '../components/content/SaveButton';
import { Chip, ChipRow, ErrorState, Freshness, NeedsKey, Skeleton } from '../components/ui/primitives';
import type { TKey } from '../lib/messages';
import type { ContentItem } from '../lib/types';

type Key = keyof TrendingData;
const ORDER: { key: Key; label: TKey; source: string; note: TKey }[] = [
  { key: 'movies', label: 'tr_movies', source: 'TMDB', note: 'tr_note_tmdb' },
  { key: 'tv', label: 'tr_tv', source: 'TMDB', note: 'tr_note_tmdb' },
  { key: 'games', label: 'tr_games', source: 'RAWG', note: 'tr_note_rawg' },
  { key: 'news', label: 'tr_news', source: 'Wikipedia', note: 'tr_note_wiki' },
  { key: 'tech', label: 'tr_tech', source: 'Hacker News', note: 'tr_note_hn' },
];

function TopCard({ item }: { item: ContentItem }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border hairline shadow-card">
      <Link to={itemPath(item)} onClick={() => primed.set(item.id, item)} className="block">
        <div className="relative aspect-[16/10] sm:aspect-[21/9]">
          <Cover item={item} sizes="lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5">
            <span className="font-display text-[64px] font-bold leading-[0.8] text-gradient">1</span>
            <div className="min-w-0 flex-1 pb-1">
              <CategoryLabel item={item} onImage />
              <div className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-tight text-white">{item.title}</div>
              <div className="mt-1 [&_*]:!text-white/70">
                <PopularityLine item={item} />
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="absolute end-4 top-4">
        <SaveButton item={item} />
      </div>
    </div>
  );
}

function Section({ state, label, source, note }: { state: SectionState; label: string; source: string; note: string }) {
  const { t } = useSettings();
  if (state.status === 'disabled') return null;
  return (
    <section className="mt-9">
      <div className="page-x mb-3">
        <h2 className="text-[20px] font-semibold text-ink lg:text-[22px]">{label}</h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {note}
        </p>
      </div>
      {state.status === 'needsKey' ? (
        <NeedsKey service={state.key} compact />
      ) : state.status === 'error' ? (
        <div className="page-x">
          <div className="flex items-center gap-3 rounded-2xl border hairline bg-surface p-4 text-[14px] text-muted">
            <CircleAlert className="h-5 w-5 shrink-0 text-amber-400" />
            {t('tr_unavailable', { source })}
          </div>
        </div>
      ) : state.items.length === 0 ? (
        <p className="page-x text-[14px] text-muted">{t('nothing_here')}</p>
      ) : (
        <>
          <div className="page-x">
            <TopCard item={state.items[0]} />
          </div>
          <div className="page-x mt-2 grid divide-y divide-line/[0.07] lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
            {state.items.slice(1, 10).map((i, idx) => (
              <RankCard key={i.id} item={i} rank={idx + 2} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function Trending() {
  const { settings, t } = useSettings();
  const [filter, setFilter] = useState<Key | 'all'>('all');
  const q = useQuery(`trending:${settingsSig(settings)}`, () => trending(settings), 30 * 60_000);
  const visible = ORDER.filter((o) => q.data?.[o.key].status !== 'disabled');

  return (
    <div>
      <PageHeader title={t('nav_trending')} subtitle={<Freshness updatedAt={q.updatedAt} stale={q.stale} refreshing={q.refreshing} onRefresh={q.refresh} />} />
      <ChipRow>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('all')}
        </Chip>
        {visible.map((o) => (
          <Chip key={o.key} active={filter === o.key} onClick={() => setFilter(o.key)}>
            {t(o.label)}
          </Chip>
        ))}
      </ChipRow>
      <p className="page-x mt-3 text-[12.5px] leading-relaxed text-faint">{t('tr_disclaimer')}</p>

      {q.loading ? (
        <div className="mt-8 space-y-4">
          <div className="page-x">
            <Skeleton className="aspect-[16/10] rounded-[28px] sm:aspect-[21/9]" />
          </div>
          <ListSkeleton count={5} />
        </div>
      ) : q.data ? (
        ORDER.filter((o) => filter === 'all' || o.key === filter).map((o) => (
          <Section key={o.key} state={q.data![o.key]} label={t(o.label)} source={o.source} note={t(o.note)} />
        ))
      ) : (
        <ErrorState error={q.error} onRetry={q.refresh} />
      )}
    </div>
  );
}
