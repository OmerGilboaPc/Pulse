import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Trophy } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { useQuery } from '../../hooks/useQuery';
import { discover } from '../../services/content';
import { LEAGUES, type League } from '../../lib/defaults';
import { PageHeader } from '../../components/layout/Shell';
import { Rail } from '../../components/content/Hero';
import { EditorialCard, EventCard, FeedSkeleton, RailSkeleton } from '../../components/content/Cards';
import { Chip, ChipRow, EmptyState, ErrorState, Freshness, Segmented } from '../../components/ui/primitives';
import type { TKey } from '../../lib/messages';

const SPORTS: { id: League['sport']; label: TKey }[] = [
  { id: 'basketball', label: 'sport_basketball' },
  { id: 'soccer', label: 'sport_soccer' },
  { id: 'football', label: 'sport_football' },
  { id: 'other', label: 'sport_other' },
];

export default function Sports() {
  const { settings, t } = useSettings();
  const firstLeague = LEAGUES.find((l) => l.id === settings.sportsLeagues[0]) ?? LEAGUES[0];
  const [sport, setSport] = useState<League['sport']>(firstLeague.sport);
  const leagues = useMemo(() => LEAGUES.filter((l) => l.sport === sport), [sport]);
  const [league, setLeague] = useState(firstLeague.id);

  useEffect(() => {
    if (!leagues.some((l) => l.id === league)) {
      const preferred = leagues.find((l) => settings.sportsLeagues.includes(l.id)) ?? leagues[0];
      setLeague(preferred.id);
    }
  }, [leagues, league, settings.sportsLeagues]);

  const q = useQuery(`disc:sports:${league}`, () => discover.sports(league), 5 * 60_000);
  const leagueName = LEAGUES.find((l) => l.id === league)?.name ?? '';
  const scores = q.data?.scores ?? [];
  const live = scores.filter((e) => e.meta?.state === 'in');
  const ordered = [...live, ...scores.filter((e) => e.meta?.state === 'pre'), ...scores.filter((e) => e.meta?.state === 'post')];

  return (
    <div>
      <PageHeader title={t('cat_sports')} back="/discover" />
      <div className="page-x mb-3 overflow-x-auto no-scrollbar">
        <Segmented value={sport} onChange={setSport} options={SPORTS.map((s) => ({ value: s.id, label: t(s.label) }))} />
      </div>
      <ChipRow>
        {leagues.map((l) => (
          <Chip key={l.id} active={league === l.id} onClick={() => setLeague(l.id)}>
            {l.name}
          </Chip>
        ))}
      </ChipRow>

      <Rail
        title={t('sports_scores', { league: leagueName })}
        icon={Trophy}
        subtitle={<Freshness updatedAt={q.updatedAt} stale={q.stale} refreshing={q.refreshing} onRefresh={q.refresh} sources="ESPN" />}
      >
        {q.loading ? (
          <RailSkeleton kind="event" count={3} />
        ) : ordered.length ? (
          <div className="rail">
            {ordered.map((e) => (
              <EventCard key={e.id} item={e} />
            ))}
          </div>
        ) : q.error ? (
          <ErrorState compact error={q.error} onRetry={q.refresh} />
        ) : (
          <p className="page-x text-[14px] text-muted">{q.data?.scores === null ? t('sports_scores_unavailable') : t('sports_no_games')}</p>
        )}
      </Rail>

      <section className="mt-9">
        <div className="page-x mb-3 flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-accent-ink" />
          <h2 className="text-[19px] font-semibold text-ink">{t('sports_headlines', { league: leagueName })}</h2>
        </div>
        {q.loading ? (
          <FeedSkeleton count={3} />
        ) : q.data?.news?.length ? (
          <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.news.map((i, idx) => (
              <EditorialCard key={i.id} item={i} large={idx === 0} />
            ))}
          </div>
        ) : q.error ? null : (
          <EmptyState icon={Newspaper} title={t('nothing_here')} />
        )}
      </section>
      <p className="page-x mt-6 text-[12px] text-faint">
        {t('sports_attribution')}{' '}
        <Link to="/profile/sources" className="text-accent-ink">
          {t('sports_follow')}
        </Link>
      </p>
    </div>
  );
}
