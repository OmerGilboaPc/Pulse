import { useState } from 'react';
import { Atom, Globe2, History, Image as ImageIcon, Newspaper, Telescope } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { useQuery } from '../../hooks/useQuery';
import { settingsSig } from '../../lib/actions';
import { discover } from '../../services/content';
import { PageHeader } from '../../components/layout/Shell';
import { Rail } from '../../components/content/Hero';
import { CompactRow, EditorialCard, FeedSkeleton, LandscapeCard } from '../../components/content/Cards';
import { Button, EmptyState, ErrorState, Freshness, Segmented } from '../../components/ui/primitives';
import { SourceHealth } from '../../components/content/SourceHealth';

type Tab = 'general' | 'science' | 'discoveries';

export default function World() {
  const { settings, t } = useSettings();
  const [tab, setTab] = useState<Tab>('general');
  const [more, setMore] = useState(false);
  const q = useQuery(`disc:world:${settingsSig(settings)}`, () => discover.world(settings), 15 * 60_000);
  const list = tab === 'general' ? q.data?.general ?? [] : tab === 'science' ? q.data?.science ?? [] : [];
  const digest = q.data?.digest;

  return (
    <div>
      <PageHeader title={t('cat_world')} back="/discover" />
      <div className="page-x mb-3">
        <Segmented
          value={tab}
          onChange={(v) => {
            setTab(v);
            setMore(false);
          }}
          options={[
            { value: 'general', label: t('world_general'), icon: Globe2 },
            { value: 'science', label: t('world_science'), icon: Atom },
            { value: 'discoveries', label: t('world_discoveries'), icon: Telescope },
          ]}
        />
      </div>
      <div className="page-x mb-5 flex flex-wrap items-center gap-3">
        <Freshness updatedAt={q.updatedAt} stale={q.stale} refreshing={q.refreshing} onRefresh={q.refresh} />
        <SourceHealth sources={q.data?.sources} />
      </div>

      {q.loading ? (
        <FeedSkeleton count={3} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refresh} />
      ) : tab === 'discoveries' ? (
        digest ? (
          <div>
            {[digest.featured, digest.picture].filter(Boolean).length > 0 && (
              <div className="page-x grid gap-4 sm:grid-cols-2">
                {digest.featured && <EditorialCard item={digest.featured} large />}
                {digest.picture && <EditorialCard item={digest.picture} large />}
              </div>
            )}
            {digest.onThisDay.length > 0 && (
              <section className="mt-9">
                <div className="page-x mb-2 flex items-center gap-2">
                  <History className="h-5 w-5 text-accent-ink" />
                  <h2 className="text-[19px] font-semibold text-ink">{t('world_otd')}</h2>
                </div>
                <div className="page-x divide-y divide-white/5">
                  {digest.onThisDay.map((i) => (
                    <CompactRow key={i.id} item={i} subtitle={`${i.subtitle} · ${i.sourceName}`} />
                  ))}
                </div>
              </section>
            )}
            {digest.mostRead.length > 0 && (
              <Rail title={t('world_mostread')} icon={ImageIcon} subtitle={t('world_mostread_sub')} to="/trending">
                <div className="rail">
                  {digest.mostRead.filter((i) => i.image).slice(0, 12).map((i) => (
                    <LandscapeCard key={i.id} item={i} />
                  ))}
                </div>
              </Rail>
            )}
          </div>
        ) : (
          <EmptyState icon={Telescope} title={t('world_wiki_unavailable')} />
        )
      ) : list.length ? (
        <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, more ? 60 : 12).map((i, idx) => (
            <div key={i.id} className={idx === 0 ? 'sm:col-span-2 xl:col-span-2' : ''}>
              <EditorialCard item={i} large={idx === 0} />
            </div>
          ))}
          {list.length > 12 && !more && (
            <div className="flex justify-center sm:col-span-2 xl:col-span-3">
              <Button onClick={() => setMore(true)}>{t('loadMore')}</Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={Newspaper} title={t('nothing_here')} body={t('world_empty_body')} />
      )}
    </div>
  );
}
