import { useState } from 'react';
import { CalendarDays, Flame, Gamepad2, Sparkles } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { useQuery } from '../../hooks/useQuery';
import { settingsSig } from '../../lib/actions';
import { discover, hasRawg } from '../../services/content';
import { PLATFORM_FILTERS } from '../../services/rawg';
import { DEMO_GAMES } from '../../services/demo';
import { PageHeader } from '../../components/layout/Shell';
import { HeroCarousel, Rail } from '../../components/content/Hero';
import { EditorialCard, FeedSkeleton, LandscapeCard, PosterCard, RailSkeleton } from '../../components/content/Cards';
import { Chip, ChipRow, EmptyState, ErrorState, Freshness, Skeleton } from '../../components/ui/primitives';
import { SampleNotice } from './MoviesTv';

export default function Games() {
  const { settings, t } = useSettings();
  const [platform, setPlatform] = useState<number | undefined>();
  const sig = settingsSig(settings);
  const keyed = hasRawg(settings);
  const q = useQuery(keyed ? `disc:games:${platform ?? 0}:${sig}` : null, () => discover.games(settings, platform), 60 * 60_000);
  const news = useQuery(`disc:gamenews:${sig}`, () => discover.gameNews(settings), 15 * 60_000);
  const pf = PLATFORM_FILTERS.find((p) => p.id === platform);

  const matchesPlatform = (platforms?: string[]) => !pf || (platforms ?? []).some((p) => p.toLowerCase().includes(pf.name.toLowerCase().slice(0, 4)));
  const demo = DEMO_GAMES.filter((g) => matchesPlatform(g.platforms));

  return (
    <div>
      <PageHeader title={t('cat_games')} back="/discover" />
      <ChipRow className="mb-4">
        <Chip active={!platform} onClick={() => setPlatform(undefined)}>
          {t('allPlatforms')}
        </Chip>
        {PLATFORM_FILTERS.map((p) => (
          <Chip key={p.id} active={platform === p.id} onClick={() => setPlatform(p.id)}>
            {p.name}
          </Chip>
        ))}
      </ChipRow>

      {!keyed ? (
        <>
          <SampleNotice service="rawg" />
          <Rail title={t('sample_rail')} subtitle={t('sample_rail_sub')}>
            {demo.length ? (
              <div className="rail">
                {demo.map((g) => (
                  <PosterCard key={g.id} item={g} />
                ))}
              </div>
            ) : (
              <p className="page-x text-sm text-muted">{t('nothing_filter')}</p>
            )}
          </Rail>
        </>
      ) : q.loading ? (
        <>
          <div className="page-x">
            <Skeleton className="aspect-[4/5] rounded-[28px] sm:aspect-[16/9] lg:aspect-[21/9]" />
          </div>
          <div className="mt-8">
            <RailSkeleton />
          </div>
        </>
      ) : q.data ? (
        <>
          <HeroCarousel items={q.data.popular.filter((g) => g.image).slice(0, 5)} />
          <Rail title={t('games_popular')} icon={Flame} subtitle={<Freshness updatedAt={q.updatedAt} stale={q.stale} sources="RAWG" />}>
            <div className="rail">
              {q.data.popular.map((g) => (
                <LandscapeCard key={g.id} item={g} />
              ))}
            </div>
          </Rail>
          <Rail title={t('games_new')} icon={Sparkles} subtitle={t('games_new_sub')}>
            {q.data.fresh.length ? (
              <div className="rail">
                {q.data.fresh.map((g) => (
                  <PosterCard key={g.id} item={g} />
                ))}
              </div>
            ) : (
              <p className="page-x text-sm text-muted">{t('nothing_filter')}</p>
            )}
          </Rail>
          <Rail title={t('games_upcoming')} icon={CalendarDays} to="/calendar">
            {q.data.upcoming.length ? (
              <div className="rail">
                {q.data.upcoming.map((g) => (
                  <PosterCard key={g.id} item={g} showCountdown />
                ))}
              </div>
            ) : (
              <p className="page-x text-sm text-muted">{t('nothing_filter')}</p>
            )}
          </Rail>
        </>
      ) : (
        <ErrorState error={q.error} onRetry={q.refresh} />
      )}

      <section className="mt-9">
        <div className="page-x mb-3">
          <h2 className="text-[19px] font-semibold text-ink">{t('games_news')}</h2>
        </div>
        {news.loading ? (
          <FeedSkeleton count={2} />
        ) : news.data?.items.length ? (
          <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {news.data.items.slice(0, 9).map((i) => (
              <EditorialCard key={i.id} item={i} />
            ))}
          </div>
        ) : news.error ? (
          <ErrorState compact error={news.error} onRetry={news.refresh} />
        ) : (
          <EmptyState icon={Gamepad2} title={t('games_news_empty')} body={t('games_news_empty_body')} />
        )}
      </section>
    </div>
  );
}
