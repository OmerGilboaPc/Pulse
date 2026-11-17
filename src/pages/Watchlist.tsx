import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Bookmark, Check, CircleCheck, Compass, ExternalLink, FolderPlus, MoreHorizontal, Pencil, Search, StickyNote, Trash2, X } from 'lucide-react';
import { db, type Collection, type WatchEntry } from '../lib/db';
import {
  createCollection,
  deleteCollection,
  removeItem,
  renameCollection,
  restoreEntry,
  setNote,
  setStatus,
  toggleCollection,
  validateCollectionName,
  type CollectionError,
} from '../lib/actions';
import { useSettings } from '../store/settings';
import type { ContentKind, WatchStatus } from '../lib/types';
import { formatDate, relativeTime } from '../lib/format';
import { PageHeader } from '../components/layout/Shell';
import { Cover } from '../components/content/Cover';
import { CategoryLabel, Countdown, DemoBadge, itemPath, primed } from '../components/content/Cards';
import { ConfirmSheet, Sheet, useToast } from '../components/ui/overlays';
import { Button, Chip, ChipRow, cx, EmptyState, FieldError, Segmented } from '../components/ui/primitives';
import { ReminderForm } from './Notifications';
import type { TKey } from '../lib/messages';

type KindFilter = 'all' | ContentKind;
type Sort = 'added' | 'release' | 'title';

const KIND_FILTERS: { id: KindFilter; label: TKey }[] = [
  { id: 'all', label: 'all' },
  { id: 'movie', label: 'kind_movies' },
  { id: 'tv', label: 'kind_shows' },
  { id: 'game', label: 'kind_games' },
  { id: 'article', label: 'kind_articles' },
  { id: 'event', label: 'kind_events' },
];

const STATUS_LABEL: Record<WatchStatus, TKey> = { planned: 'st_planned', active: 'st_active', completed: 'st_completed' };

export function CollectionForm({ initial, onDone, id }: { initial?: string; id?: string; onDone: (c?: Collection) => void }) {
  const { t } = useSettings();
  const [name, setName] = useState(initial ?? '');
  const [error, setError] = useState<CollectionError | null>(null);
  const errors: Record<CollectionError, TKey> = { required: 'col_err_required', tooLong: 'col_err_long', duplicate: 'col_err_dup' };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await validateCollectionName(name, id);
        setError(err);
        if (err) return;
        if (id) {
          await renameCollection(id, name);
          onDone();
        } else {
          onDone(await createCollection(name));
        }
      }}
      noValidate
    >
      <label className="mb-1.5 block text-[13px] font-semibold text-muted" htmlFor="col-name">
        {t('col_name')}
      </label>
      <input
        id="col-name"
        className="input"
        value={name}
        maxLength={60}
        autoFocus
        placeholder={t('col_placeholder')}
        aria-invalid={!!error}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      <div className="mt-1 flex justify-between">
        <FieldError>{error && t(errors[error])}</FieldError>
        <span className={cx('ms-auto mt-1.5 text-[12px] tabular-nums', name.trim().length > 40 ? 'text-rose-400' : 'text-faint')}>{name.trim().length}/40</span>
      </div>
      <Button type="submit" variant="primary" className="mt-4 w-full">
        {id ? t('save') : t('col_create')}
      </Button>
    </form>
  );
}

function EntryEditor({ entry, collections, onClose }: { entry: WatchEntry; collections: Collection[]; onClose: () => void }) {
  const { t } = useSettings();
  const toast = useToast();
  const [note, setNoteText] = useState(entry.note);
  const [creating, setCreating] = useState(false);
  const [reminding, setReminding] = useState(false);
  useEffect(() => setNoteText(entry.note), [entry.id, entry.note]);
  const dirty = note !== entry.note;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border hairline">
          <Cover item={entry.item} sizes="sm" showArtTitle={false} />
        </div>
        <div className="min-w-0">
          <CategoryLabel item={entry.item} />
          <div className="line-clamp-2 font-semibold text-ink">{entry.item.title}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold text-muted">{t('wl_status')}</div>
        <Segmented
          value={entry.status}
          onChange={(s) => void setStatus(entry.id, s)}
          options={(['planned', 'active', 'completed'] as WatchStatus[]).map((s) => ({ value: s, label: t(STATUS_LABEL[s]) }))}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">{t('wl_collections')}</span>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-[13px] font-semibold text-accent-ink">
            <FolderPlus className="h-4 w-4" />
            {t('col_new')}
          </button>
        </div>
        {collections.length ? (
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => {
              const on = entry.collectionIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => void toggleCollection(entry.id, c.id)}
                  aria-pressed={on}
                  className={cx('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition', on ? 'border-transparent bg-accent/15 text-accent-ink' : 'hairline bg-elevated text-muted')}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
                  {c.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-faint">{t('col_none_yet')}</p>
        )}
        {creating && (
          <div className="mt-3 rounded-2xl border hairline bg-elevated/40 p-4">
            <CollectionForm
              onDone={async (c) => {
                setCreating(false);
                if (c) await toggleCollection(entry.id, c.id);
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="note" className="mb-2 block text-[13px] font-semibold text-muted">
          {t('wl_note')}
        </label>
        <textarea
          id="note"
          className="input min-h-[96px] resize-y"
          value={note}
          maxLength={1000}
          placeholder={t('wl_note_placeholder')}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12px] tabular-nums text-faint">{note.length}/1000</span>
          <Button
            size="sm"
            variant={dirty ? 'primary' : 'secondary'}
            disabled={!dirty}
            onClick={async () => {
              await setNote(entry.id, note);
              toast({ message: t('wl_note_saved'), tone: 'success' });
            }}
          >
            {t('wl_save_note')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to={itemPath(entry.item)} onClick={onClose} className="flex h-11 items-center justify-center gap-2 rounded-full border hairline bg-elevated text-sm font-semibold text-ink">
          <ExternalLink className="h-4 w-4" />
          {t('details')}
        </Link>
        <button onClick={() => setReminding((v) => !v)} className="flex h-11 items-center justify-center gap-2 rounded-full border hairline bg-elevated text-sm font-semibold text-ink">
          <Bell className="h-4 w-4" />
          {t('rem_add')}
        </button>
      </div>
      {reminding && (
        <div className="rounded-2xl border hairline bg-elevated/40 p-4">
          <ReminderForm item={entry.item} onDone={() => setReminding(false)} />
        </div>
      )}
      <Button
        variant="danger"
        icon={Trash2}
        className="w-full"
        onClick={async () => {
          const removed = await removeItem(entry.id);
          onClose();
          toast({ message: t('toast_removed'), action: removed ? { label: t('undo'), run: () => void restoreEntry(removed) } : undefined });
        }}
      >
        {t('wl_remove')}
      </Button>
    </div>
  );
}

function EntryRow({ entry, onOpen }: { entry: WatchEntry; onOpen: () => void }) {
  const { t, settings } = useSettings();
  const done = entry.status === 'completed';
  const item = entry.item;
  const portrait = item.kind === 'movie' || item.kind === 'tv' || item.kind === 'game';
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} className="flex items-center gap-3 rounded-3xl border hairline bg-surface p-2.5 pe-3">
      <Link to={itemPath(item)} onClick={() => primed.set(item.id, item)} className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cx('relative shrink-0 overflow-hidden rounded-2xl', portrait ? 'h-[88px] w-[60px]' : 'h-[64px] w-[88px]', done && 'opacity-60')}>
          <Cover item={item} variant={portrait ? 'poster' : 'wide'} sizes="sm" showArtTitle={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CategoryLabel item={item} />
            <DemoBadge item={item} />
          </div>
          <div className={cx('mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            {entry.status !== 'planned' && <span className={cx('font-semibold', done ? 'text-emerald-400' : 'text-accent-ink')}>{t(STATUS_LABEL[entry.status])}</span>}
            {item.kind !== 'article' && item.date && <Countdown date={item.date} className="!bg-elevated !text-muted" />}
            <span className="text-faint">{t('wl_added', { time: relativeTime(entry.addedAt, settings.language) })}</span>
          </div>
          {entry.note && (
            <div className="mt-1 flex items-start gap-1 text-[12.5px] text-muted">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{entry.note}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-2">
        <button
          aria-label={done ? t('wl_mark_planned') : t('wl_mark_done')}
          title={done ? t('wl_mark_planned') : t('wl_mark_done')}
          onClick={() => void setStatus(entry.id, done ? 'planned' : 'completed')}
          className={cx('tap-target flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-90', done ? 'border-transparent bg-emerald-400 text-black' : 'hairline bg-elevated text-muted')}
        >
          <Check className="h-[17px] w-[17px]" strokeWidth={2.6} />
        </button>
        <button aria-label={t('wl_manage')} title={t('wl_manage')} onClick={onOpen} className="tap-target flex h-9 w-9 items-center justify-center rounded-full border hairline bg-elevated text-muted hover:text-ink">
          <MoreHorizontal className="h-[17px] w-[17px]" />
        </button>
      </div>
    </motion.li>
  );
}

export default function Watchlist() {
  const { t, settings } = useSettings();
  const entries = useLiveQuery(() => db.watchlist.orderBy('addedAt').reverse().toArray(), []);
  const collections = useLiveQuery(() => db.collections.orderBy('createdAt').toArray(), []) ?? [];
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [collection, setCollection] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('added');
  const [editing, setEditing] = useState<string | null>(null);
  const [newCol, setNewCol] = useState(false);
  const [manageCol, setManageCol] = useState<Collection | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null);

  const all = entries ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter(
      (e) =>
        (kind === 'all' || e.kind === kind) &&
        (status === 'all' || (status === 'completed' ? e.status === 'completed' : e.status !== 'completed')) &&
        (collection === 'all' || e.collectionIds.includes(collection)) &&
        (!q || `${e.item.title} ${e.note} ${e.item.sourceName ?? ''} ${(e.item.genres ?? []).join(' ')}`.toLowerCase().includes(q)),
    );
    if (sort === 'title') list.sort((a, b) => a.item.title.localeCompare(b.item.title, settings.language));
    if (sort === 'release') list.sort((a, b) => (a.item.date ?? '9999').localeCompare(b.item.date ?? '9999'));
    return list;
  }, [all, kind, status, collection, query, sort, settings.language]);

  const editingEntry = all.find((e) => e.id === editing) ?? null;
  const kindCounts = (k: KindFilter) => (k === 'all' ? all.length : all.filter((e) => e.kind === k).length);
  const completed = all.filter((e) => e.status === 'completed').length;

  if (entries === undefined) return <PageHeader title={t('nav_watchlist')} />;

  return (
    <div>
      <PageHeader title={t('nav_watchlist')} subtitle={all.length ? t('wl_summary', { n: all.length, done: completed }) : undefined} />
      {all.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t('wl_empty')}
          body={t('wl_empty_body')}
          action={
            <Link to="/discover" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-glow">
              <Compass className="h-4 w-4" />
              {t('wl_explore')}
            </Link>
          }
        />
      ) : (
        <>
          <div className="page-x mb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
              <input
                type="search"
                className="input !ps-11"
                placeholder={t('wl_search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('wl_search')}
                enterKeyHint="search"
              />
              {query && (
                <button aria-label={t('clear')} onClick={() => setQuery('')} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <ChipRow>
            {KIND_FILTERS.filter((k) => k.id === 'all' || kindCounts(k.id) > 0).map((k) => (
              <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)} count={kindCounts(k.id)}>
                {t(k.label)}
              </Chip>
            ))}
          </ChipRow>

          <div className="mt-4">
            <div className="page-x mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-muted">{t('wl_collections')}</span>
              <button onClick={() => setNewCol(true)} className="flex items-center gap-1 text-[13px] font-semibold text-accent-ink">
                <FolderPlus className="h-4 w-4" />
                {t('col_new')}
              </button>
            </div>
            <ChipRow>
              <Chip active={collection === 'all'} onClick={() => setCollection('all')}>
                {t('col_all')}
              </Chip>
              {collections.map((c) => (
                <Chip key={c.id} active={collection === c.id} onClick={() => setCollection(c.id)} color={c.color} count={all.filter((e) => e.collectionIds.includes(c.id)).length}>
                  {c.name}
                </Chip>
              ))}
            </ChipRow>
            {collection !== 'all' && collections.find((c) => c.id === collection) && (
              <div className="page-x mt-2 flex gap-3">
                <button onClick={() => setManageCol(collections.find((c) => c.id === collection)!)} className="flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-ink">
                  <Pencil className="h-3.5 w-3.5" />
                  {t('col_rename')}
                </button>
                <button onClick={() => setConfirmDelete(collections.find((c) => c.id === collection)!)} className="flex items-center gap-1 text-[12.5px] font-semibold text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('col_delete')}
                </button>
              </div>
            )}
          </div>

          <div className="page-x mt-4 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={status}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: t('all') },
                { value: 'open', label: t('wl_open') },
                { value: 'completed', label: t('st_completed'), icon: CircleCheck },
              ]}
            />
            <label className="flex items-center gap-2 text-[13px] text-muted">
              {t('wl_sort')}
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border hairline bg-elevated px-3 py-1.5 text-[13px] font-semibold text-ink outline-none">
                <option value="added">{t('wl_sort_added')}</option>
                <option value="release">{t('wl_sort_release')}</option>
                <option value="title">{t('wl_sort_title')}</option>
              </select>
            </label>
          </div>

          {filtered.length ? (
            <ul className="page-x mt-4 grid gap-2.5 lg:grid-cols-2">
              <AnimatePresence initial={false}>
                {filtered.map((e) => (
                  <EntryRow key={e.id} entry={e} onOpen={() => setEditing(e.id)} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <EmptyState icon={Search} title={t('wl_no_match')} body={t('wl_no_match_body')} />
          )}
          <p className="page-x mt-6 text-center text-[12px] text-faint">
            {t('wl_local_note')} · {formatDate(new Date().toISOString(), settings.language)}
          </p>
        </>
      )}

      <Sheet open={!!editingEntry} onClose={() => setEditing(null)} title={t('wl_manage')}>
        {editingEntry && <EntryEditor entry={editingEntry} collections={collections} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={newCol} onClose={() => setNewCol(false)} title={t('col_new')}>
        <CollectionForm
          onDone={(c) => {
            setNewCol(false);
            if (c) setCollection(c.id);
          }}
        />
      </Sheet>
      <Sheet open={!!manageCol} onClose={() => setManageCol(null)} title={t('col_rename')}>
        {manageCol && <CollectionForm id={manageCol.id} initial={manageCol.name} onDone={() => setManageCol(null)} />}
      </Sheet>
      <ConfirmSheet
        open={!!confirmDelete}
        title={t('col_delete_title', { name: confirmDelete?.name ?? '' })}
        body={t('col_delete_body')}
        confirmLabel={t('col_delete')}
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteCollection(confirmDelete.id);
          setCollection('all');
        }}
      />
    </div>
  );
}
