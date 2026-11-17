import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUpLeft, ChevronLeft, Clock, Flame, Search as SearchIcon, X } from 'lucide-react';
import { db } from '../lib/db';
import { recordSearch, settingsSig } from '../lib/actions';
import { useSettings } from '../store/settings';
import { useQuery } from '../hooks/useQuery';
import { hasRawg, hasTmdb, search, trending } from '../services/content';
import type { ContentItem } from '../lib/types';
import { CompactRow, ListSkeleton } from '../components/content/Cards';
import { Chip, ChipRow, cx, EmptyState, ErrorState, NeedsKey } from '../components/ui/primitives';
import { isHttpError } from '../services/http';
import type { TKey } from '../lib/messages';

type Scope = 'all' | 'movies' | 'tv' | 'games' | 'news' | 'saved';
const SCOPES: { id: Scope; label: TKey }[] = [
  { id: 'all', label: 'all' },
  { id: 'movies', label: 'cat_movies' },
  { id: 'tv', label: 'cat_tv' },
  { id: 'games', label: 'cat_games' },
  { id: 'news', label: 'search_news' },
  { id: 'saved', label: 'search_saved' },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Group({ title, items, loading, error, needsKey, limit = 6, onPick }: { title: string; items?: ContentItem[]; loading?: boolean; error?: unknown; needsKey?: 'tmdb' | 'rawg'; limit?: number; onPick: () => void }) {
  const { t } = useSettings();
  const [expanded, setExpanded] = useState(false);
  if (needsKey) {
    return (
      <section className="mt-6">
        <h2 className="page-x mb-2 text-[15px] font-semibold text-muted">{title}</h2>
        <NeedsKey service={needsKey} compact />
      </section>
    );
  }
  if (!loading && !error && !items?.length) return null;
  const shown = expanded ? items ?? [] : (items ?? []).slice(0, limit);
  return (
    <section className="mt-6">
      <div className="page-x mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-muted">
          {title}
          {items?.length ? <span className="ms-2 text-faint">{items.length}</span> : null}
        </h2>
        {(items?.length ?? 0) > limit && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[13px] font-semibold text-accent-ink">
            {expanded ? t('showLess') : t('seeAll')}
          </button>
        )}
      </div>
      {loading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState compact error={error} />
      ) : (
        <div className="page-x divide-y divide-line/[0.07]" onClickCapture={onPick}>
          {shown.map((i) => (
            <CompactRow key={i.id} item={i} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Search() {
  const { settings, t } = useSettings();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [scope, setScope] = useState<Scope>((params.get('scope') as Scope) || 'all');
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = useDebounced(text.trim(), 380);
  const active = q.length >= 2;
  const sig = settingsSig(settings);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (scope !== 'all') next.set('scope', scope);
    setParams(next, { replace: true });
  }, [q, scope, setParams]);

  const history = useLiveQuery(() => db.searches.orderBy('at').reverse().limit(12).toArray(), []) ?? [];
  const savedAll = useLiveQuery(() => db.watchlist.toArray(), []) ?? [];
  const trendingQ = useQuery(`trending:${sig}`, () => trending(settings), 30 * 60_000);

  const wantMedia = scope === 'all' || scope === 'movies' || scope === 'tv';
  const media = useQuery(active && wantMedia ? `search:media:${q}:${sig}` : null, () => search.media(settings, q), 10 * 60_000);
  const games = useQuery(active && (scope === 'all' || scope === 'games') && hasRawg(settings) ? `search:games:${q}:${sig}` : null, () => search.games(settings, q), 10 * 60_000);
  const news = useQuery(active && (scope === 'all' || scope === 'news') ? `search:news:${q}:${sig}` : null, () => search.news(q), 10 * 60_000);

  const savedMatches = useMemo(() => {
    if (!active) return [];
    const ql = q.toLowerCase();
    return savedAll.filter((e) => `${e.item.title} ${e.note} ${(e.item.genres ?? []).join(' ')}`.toLowerCase().includes(ql)).map((e) => e.item);
  }, [active, q, savedAll]);

  const trendingTitles = useMemo(() => {
    const d = trendingQ.data;
    if (!d) return [] as string[];
    const out: string[] = [];
    for (const s of [d.movies, d.tv, d.games, d.news]) if (s.status === 'ok') out.push(...s.items.slice(0, 3).map((i) => i.title));
    return out.slice(0, 10);
  }, [trendingQ.data]);

  const suggestions = useMemo(() => {
    const v = text.trim().toLowerCase();
    if (!v) return [];
    const pool = [...history.map((h) => h.query), ...savedAll.map((e) => e.item.title), ...trendingTitles];
    return [...new Set(pool)].filter((s) => s.toLowerCase().includes(v) && s.toLowerCase() !== v).slice(0, 6);
  }, [text, history, savedAll, trendingTitles]);

  const mediaItems = (media.data ?? []).filter((i) => scope === 'all' || i.category === scope);
  const mediaError = media.error && !(isHttpError(media.error) && media.error.kind === 'config') ? media.error : undefined;
  const commit = () => void recordSearch(q);
  const nothing =
    active &&
    !media.loading && !games.loading && !news.loading &&
    !mediaItems.length && !(games.data?.length) && !(news.data?.length) && !savedMatches.length &&
    !media.error && !news.error && !games.error;

  const pick = (s: string) => {
    setText(s);
    void recordSearch(s);
    input.current?.blur();
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass border-b hairline pt-safe">
        <div className="page-x flex h-16 items-center gap-2">
          <button onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))} aria-label={t('back')} className="tap-target -ms-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-elevated">
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
          <form
            role="search"
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              commit();
              input.current?.blur();
            }}
          >
            <SearchIcon className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-accent-ink" />
            <input
              ref={input}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={t('search_placeholder')}
              aria-label={t('nav_search')}
              className="input h-12 !rounded-full !ps-11 !pe-10"
            />
            {text && (
              <button type="button" aria-label={t('clear')} onClick={() => { setText(''); input.current?.focus(); }} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-faint/30 p-1 text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
        <ChipRow className="pb-2.5">
          {SCOPES.map((s) => (
            <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)}>
              {t(s.label)}
            </Chip>
          ))}
        </ChipRow>
      </header>

      {focused && suggestions.length > 0 && (
        <ul className="page-x mt-2" aria-label={t('search_suggestions')}>
          {suggestions.map((s) => (
            <li key={s}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-start text-[15px] text-ink hover:bg-elevated/50">
                <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
                <span className="flex-1 truncate">{s}</span>
                <ArrowUpLeft className="h-4 w-4 shrink-0 text-faint rtl:-scale-x-100" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!active ? (
        <div className="mt-4">
          {history.length > 0 && (
            <section className="page-x">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-muted">{t('search_recent')}</h2>
                <button onClick={() => void db.searches.clear()} className="text-[13px] font-semibold text-accent-ink">
                  {t('clearAll')}
                </button>
              </div>
              <ul className="divide-y divide-line/[0.07]">
                {history.map((h) => (
                  <li key={h.query} className="flex items-center gap-3 py-1">
                    <button onClick={() => pick(h.query)} className="flex flex-1 items-center gap-3 py-2 text-start text-[15px] text-ink">
                      <Clock className="h-4 w-4 shrink-0 text-faint" />
                      <span className="truncate">{h.query}</span>
                    </button>
                    <button aria-label={t('remove')} onClick={() => void db.searches.delete(h.query)} className="tap-target rounded-full p-1.5 text-faint hover:text-ink">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {trendingTitles.length > 0 && (
            <section className="page-x mt-6">
              <h2 className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold text-muted">
                <Flame className="h-4 w-4 text-accent-ink" />
                {t('search_trending')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {trendingTitles.map((s) => (
                  <button key={s} onClick={() => pick(s)} className="max-w-full truncate rounded-full border hairline bg-surface px-3.5 py-2 text-[13.5px] font-medium text-ink hover:border-accent/40">
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!history.length && !trendingTitles.length && <EmptyState icon={SearchIcon} title={t('search_start')} body={t('search_start_body')} />}
          {text.trim().length === 1 && <p className="page-x mt-4 text-[13px] text-faint">{t('search_min')}</p>}
        </div>
      ) : (
        <div className={cx('pb-6', focused && suggestions.length > 0 && 'opacity-60')}>
          {(scope === 'all' || scope === 'saved') && <Group title={t('search_saved')} items={savedMatches} onPick={commit} />}
          {wantMedia && (
            <Group
              title={hasTmdb(settings) ? t('search_movies_tv') : t('search_tv_maze')}
              items={mediaItems}
              loading={media.loading}
              error={mediaError}
              onPick={commit}
            />
          )}
          {wantMedia && !hasTmdb(settings) && scope !== 'tv' && <Group title={t('cat_movies')} needsKey="tmdb" onPick={commit} />}
          {(scope === 'all' || scope === 'games') &&
            (hasRawg(settings) ? <Group title={t('cat_games')} items={games.data} loading={games.loading} error={games.error} onPick={commit} /> : <Group title={t('cat_games')} needsKey="rawg" onPick={commit} />)}
          {(scope === 'all' || scope === 'news') && <Group title={t('search_news')} items={news.data} loading={news.loading} error={news.error} limit={8} onPick={commit} />}
          {nothing && <EmptyState icon={SearchIcon} title={t('search_none', { q })} body={t('search_none_body')} />}
        </div>
      )}
    </div>
  );
}
