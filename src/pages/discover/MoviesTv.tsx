import { useState } from 'react';
import { Clapperboard, Film, Play, Star, Tv } from 'lucide-react';
import { useSettings } from '../../store/settings';
import { useQuery } from '../../hooks/useQuery';
import { settingsSig } from '../../lib/actions';
import { discover, hasTmdb, tvAiring } from '../../services/content';
import { MOVIE_GENRE_FILTERS, movieGenreName } from '../../services/tmdb';
import { DEMO_MOVIES } from '../../services/demo';
import type { ContentItem, Trailer } from '../../lib/types';
import { PageHeader } from '../../components/layout/Shell';
import { HeroCarousel, Rail, TrailerCard, TrailerPlayer } from '../../components/content/Hero';
import { EditorialCard, FeedSkeleton, PosterCard, RailSkeleton } from '../../components/content/Cards';
import { Chip, ChipRow, ErrorState, Freshness, NeedsKey, Segmented, Skeleton } from '../../components/ui/primitives';

function PosterRail({ items, countdown }: { items: ContentItem[]; countdown?: boolean }) {
  return (
    <div className="rail">
      {items.map((i) => (
        <PosterCard key={i.id} item={i} showCountdown={countdown} />
      ))}
    </div>
  );
}

export function SampleNotice({ service }: { service: 'tmdb' | 'rawg' }) {
  return (
    <div className="mt-2">
      <NeedsKey service={service} compact />
    </div>
  );
}

export default function MoviesTv({ initialTab }: { initialTab: 'movies' | 'tv' }) {
  const { settings, t, tx } = useSettings();
  const enabledMovies = settings.enabledCategories.includes('movies');
  const enabledTv = settings.enabledCategories.includes('tv');
  const [tab, setTab] = useState<'movies' | 'tv'>(enabledMovies ? initialTab : 'tv');
  const [genre, setGenre] = useState<number | undefined>(undefined);
  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const sig = settingsSig(settings);
  const keyed = hasTmdb(settings);

  const movies = useQuery(tab === 'movies' && keyed ? `disc:movies:${genre ?? 0}:${sig}` : null, () => discover.movies(settings, genre), 60 * 60_000);
  const trailers = useQuery(tab === 'movies' && keyed ? `disc:trailers:${sig}` : null, () => discover.trailers(settings), 12 * 3600_000);
  const tv = useQuery(tab === 'tv' && keyed ? `disc:tv:${sig}` : null, () => discover.tv(settings), 60 * 60_000);
  const airing = useQuery(tab === 'tv' ? `disc:airing:${settings.region}:${new Date().toDateString()}` : null, () => tvAiring(settings), 30 * 60_000);
  const news = useQuery(`disc:entnews:${sig}`, () => discover.entertainmentNews(settings), 15 * 60_000);

  const tabs = [
    ...(enabledMovies ? [{ value: 'movies' as const, label: t('cat_movies'), icon: Film }] : []),
    ...(enabledTv ? [{ value: 'tv' as const, label: t('cat_tv'), icon: Tv }] : []),
  ];
  const newsItems = (news.data?.items ?? []).filter((i) => i.category === (tab === 'movies' ? 'movies' : 'tv')).slice(0, 6);

  return (
    <div>
      <PageHeader title={t('disc_moviesTv')} back="/discover" />
      {tabs.length > 1 && (
        <div className="page-x mb-4">
          <Segmented value={tab} onChange={setTab} options={tabs} />
        </div>
      )}

      {tab === 'movies' && !keyed && (
        <>
          <SampleNotice service="tmdb" />
          <Rail title={t('sample_rail')} subtitle={t('sample_rail_sub')}>
            <PosterRail items={DEMO_MOVIES} />
          </Rail>
        </>
      )}

      {tab === 'movies' && keyed && (
        <>
          {movies.loading ? (
            <div className="page-x">
              <Skeleton className="aspect-[4/5] rounded-[28px] sm:aspect-[16/9] lg:aspect-[21/9]" />
            </div>
          ) : movies.data ? (
            <HeroCarousel items={movies.data.nowPlaying.filter((m) => m.image).slice(0, 5)} />
          ) : (
            <ErrorState error={movies.error} onRetry={movies.refresh} />
          )}

          <ChipRow className="mt-6">
            <Chip active={!genre} onClick={() => setGenre(undefined)}>
              {t('all')}
            </Chip>
            {MOVIE_GENRE_FILTERS.map((g) => (
              <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>
                {tx(`genre_${g}`, movieGenreName(g))}
              </Chip>
            ))}
          </ChipRow>

          <Rail title={genre ? t('disc_popular_genre', { genre: tx(`genre_${genre}`, movieGenreName(genre)) }) : t('disc_popular_movies')} subtitle={<Freshness updatedAt={movies.updatedAt} stale={movies.stale} />}>
            {movies.loading ? <RailSkeleton /> : <PosterRail items={movies.data?.popular ?? []} />}
          </Rail>
          {trailers.loading ? (
            <Rail title={t('disc_trailers')} icon={Play}>
              <RailSkeleton kind="landscape" count={3} />
            </Rail>
          ) : (trailers.data?.length ?? 0) > 0 ? (
            <Rail title={t('disc_trailers')} icon={Play} subtitle={t('disc_trailers_sub')}>
              <div className="rail">
                {trailers.data!.map((tr) => (
                  <TrailerCard key={tr.key} trailer={tr} item={tr.item} onPlay={() => setTrailer(tr)} />
                ))}
              </div>
            </Rail>
          ) : null}
          <Rail title={t('disc_in_theaters')} icon={Clapperboard}>
            {movies.loading ? <RailSkeleton /> : <PosterRail items={movies.data?.nowPlaying ?? []} />}
          </Rail>
          <Rail title={t('disc_upcoming_movies')} to="/calendar">
            {movies.loading ? <RailSkeleton /> : <PosterRail items={movies.data?.upcoming ?? []} countdown />}
          </Rail>
          <Rail title={t('disc_top_rated')} icon={Star}>
            {movies.loading ? <RailSkeleton /> : <PosterRail items={movies.data?.topRated ?? []} />}
          </Rail>
        </>
      )}

      {tab === 'tv' && (
        <>
          {!keyed && <SampleNotice service="tmdb" />}
          {keyed && (
            <>
              <Rail title={t('disc_popular_tv')} subtitle={<Freshness updatedAt={tv.updatedAt} stale={tv.stale} />}>
                {tv.loading ? <RailSkeleton /> : tv.data ? <PosterRail items={tv.data.popular} /> : <ErrorState compact error={tv.error} onRetry={tv.refresh} />}
              </Rail>
              <Rail title={t('disc_top_rated_tv')} icon={Star}>
                {tv.loading ? <RailSkeleton /> : <PosterRail items={tv.data?.topRated ?? []} />}
              </Rail>
            </>
          )}
          <Rail title={t('disc_airing_today')} subtitle={t('disc_airing_sub', { region: settings.region })}>
            {airing.loading ? (
              <RailSkeleton />
            ) : airing.data?.length ? (
              <PosterRail items={airing.data.slice(0, 24)} />
            ) : airing.error ? (
              <ErrorState compact error={airing.error} onRetry={airing.refresh} />
            ) : (
              <p className="page-x text-sm text-muted">{t('nothing_here')}</p>
            )}
          </Rail>
        </>
      )}

      {(news.loading || newsItems.length > 0) && (
        <section className="mt-9">
          <div className="page-x mb-3">
            <h2 className="text-[19px] font-semibold text-ink">{t('disc_ent_news')}</h2>
          </div>
          {news.loading ? (
            <FeedSkeleton count={2} />
          ) : (
            <div className="page-x grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {newsItems.map((i) => (
                <EditorialCard key={i.id} item={i} />
              ))}
            </div>
          )}
        </section>
      )}
      <TrailerPlayer trailer={trailer} onClose={() => setTrailer(null)} />
    </div>
  );
}
