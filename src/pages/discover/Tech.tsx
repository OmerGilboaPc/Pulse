import { useState } from 'react';
import { Bot, Cpu, Lightbulb, Code2, Smartphone, Newspaper, Flame } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { useQuery } from '../../hooks/useQuery';
import { settingsSig } from '../../lib/actions';
import { discover } from '../../services/content';
import { PageHeader } from '../../components/layout/Shell';
import { EditorialCard, FeedSkeleton, ListSkeleton, RankCard } from '../../components/content/Cards';
import { Button, Chip, ChipRow, EmptyState, ErrorState, Freshness } from '../../components/ui/primitives';
import { SourceHealth } from '../../components/content/SourceHealth';
import type { TKey } from '../../lib/messages';

const TOPICS: { id: string; label: TKey; icon: typeof Cpu }[] = [
  { id: 'all', label: 'all', icon: Cpu },
  { id: 'ai', label: 'sub_ai', icon: Bot },
  { id: 'gadgets', label: 'sub_gadgets', icon: Smartphone },
  { id: 'software', label: 'sub_software', icon: Code2 },
  { id: 'innovation', label: 'sub_innovation', icon: Lightbulb },
];

export default function Tech() {
  const { settings, t } = useSettings();
  const [topic, setTopic] = useState('all');
  const [more, setMore] = useState(false);
  const q = useQuery(`disc:tech:${settingsSig(settings)}`, () => discover.tech(settings), 15 * 60_000);
  const match = (sub?: string) => topic === 'all' || sub === topic;
  const hn = (q.data?.hn ?? []).filter((i) => match(i.subcategory));
  const news = (q.data?.news ?? []).filter((i) => match(i.subcategory));

  return (
    <div>
      <PageHeader title={t('cat_tech')} back="/discover" />
      <ChipRow className="mb-2">
        {TOPICS.map((x) => (
          <Chip key={x.id} icon={x.icon} active={topic === x.id} onClick={() => setTopic(x.id)}>
            {t(x.label)}
          </Chip>
        ))}
      </ChipRow>
      <div className="page-x mb-6 flex flex-wrap items-center gap-3">
        <Freshness updatedAt={q.updatedAt} stale={q.stale} refreshing={q.refreshing} onRefresh={q.refresh} />
        <SourceHealth sources={q.data?.sources} />
      </div>

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:px-8">
          <section className="min-w-0">
            <div className="page-x mb-3 flex items-center gap-2 lg:px-0">
              <Newspaper className="h-5 w-5 text-accent-ink" />
              <h2 className="text-[19px] font-semibold text-ink">{t('tech_news')}</h2>
            </div>
            {q.loading ? (
              <FeedSkeleton count={2} />
            ) : news.length ? (
              <div className="page-x grid gap-4 sm:grid-cols-2 lg:px-0">
                {news.slice(0, more ? 40 : 10).map((i, idx) => (
                  <div key={i.id} className={idx === 0 ? 'sm:col-span-2' : ''}>
                    <EditorialCard item={i} large={idx === 0} />
                  </div>
                ))}
                {news.length > 10 && !more && (
                  <div className="flex justify-center sm:col-span-2">
                    <Button onClick={() => setMore(true)}>{t('loadMore')}</Button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={Newspaper} title={t('nothing_filter')} body={t('tech_empty_body')} />
            )}
          </section>
          <section className="mt-9 lg:mt-0">
            <div className="page-x mb-1 lg:px-0">
              <h2 className="flex items-center gap-2 text-[19px] font-semibold text-ink">
                <Flame className="h-5 w-5 text-accent-ink" />
                {t('tech_hn')}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">{t('tech_hn_sub')}</p>
            </div>
            {q.loading ? (
              <div className="mt-3">
                <ListSkeleton count={6} />
              </div>
            ) : hn.length ? (
              <div className="page-x divide-y divide-white/5 lg:px-0">
                {hn.slice(0, 20).map((i, idx) => (
                  <RankCard key={i.id} item={i} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <p className="page-x py-6 text-sm text-muted lg:px-0">{t('nothing_filter')}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
