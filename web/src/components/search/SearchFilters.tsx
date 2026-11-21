// The advanced search popup under the navbar search box. Lazy loaded.
import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { personThumbnailUrl } from '../../api/assets';
import { getPeople, getSuggestions, getTags } from '../../api/library';
import { useFeatures } from '../../hooks/useServer';
import { usePreferences } from '../../hooks/usePreferences';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { isEmptySearch, type SearchState, type TextMode } from '../../lib/search';
import { Button } from '../ui/Button';
import { Checkbox, DateField, Field, Select } from '../ui/Fields';
import { StarRating } from '../ui/Misc';

/** A text box that suggests values from the server (cities, camera models...). Suggestions are optional. */
function SuggestField({ label, type, value, onChange, parent }: { label: string; type: string; value?: string; onChange: (v: string) => void; parent?: Record<string, unknown> }) {
  const listId = useId();
  const suggestions = useQuery({ queryKey: ['suggestions', type, parent], queryFn: () => getSuggestions(type, parent), retry: false, staleTime: 5 * 60_000 });
  return (
    <Field label={label} htmlFor={listId + 'i'}>
      <input
        id={listId + 'i'}
        list={listId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-panel px-4 py-2.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary"
      />
      <datalist id={listId}>
        {(suggestions.data ?? []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="border-t border-line pt-3">
    <legend className="mb-2 text-xs font-semibold text-primary uppercase">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </fieldset>
);

export default function SearchFilters({ initial, onSearch, onClose }: { initial: SearchState; onSearch: (s: SearchState) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const features = useFeatures().data;
  const [state, setState] = useState<SearchState>({ mode: features?.smartSearch ? 'smart' : 'filename', ...initial });
  const { preferences } = usePreferences();
  const people = useQuery({ queryKey: ['people', 'search'], queryFn: () => getPeople({ withHidden: false }), retry: false });
  const tags = useQuery({ queryKey: ['tags'], queryFn: getTags, retry: false });
  const set = <K extends keyof SearchState>(key: K, value: SearchState[K]) => setState((s) => ({ ...s, [key]: value }));
  const toggleIn = (key: 'personIds' | 'tagIds', id: string) => {
    const list = state[key] ?? [];
    set(key, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!root.current?.contains(target) && !target.closest('[role="search"]')) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const modes: Array<{ value: TextMode; label: string }> = [
    ...(features?.smartSearch !== false ? [{ value: 'smart' as const, label: t('Context (smart)') }] : []),
    { value: 'filename', label: t('File name') },
    { value: 'description', label: t('Description') },
    ...(features?.ocr ? [{ value: 'ocr' as const, label: t('Text in picture') }] : []),
  ];

  return (
    <div ref={root} className="absolute top-full left-1/2 z-[8000] mt-2 max-h-[75vh] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 overflow-y-auto rounded-3xl border border-line bg-bg p-5 shadow-2xl">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(state);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label={t('Search for')}>
            <input autoFocus value={state.text ?? ''} onChange={(e) => set('text', e.target.value)} className="w-full rounded-xl bg-panel px-4 py-2.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
          </Field>
          <Select label={t('Match')} value={state.mode ?? 'smart'} onChange={(v) => set('mode', v as TextMode)} options={modes} />
        </div>

        {(people.data?.people.length ?? 0) > 0 && (
          <Group title={t('People')}>
            <div className="col-span-full flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {people.data!.people.filter((p) => p.name).map((p) => {
                const on = state.personIds?.includes(p.id);
                return (
                  <button type="button" key={p.id} onClick={() => toggleIn('personIds', p.id)} className={cx('flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm', on && 'border-primary bg-primary/15 text-primary')}>
                    <img src={personThumbnailUrl(p.id)} alt="" className="size-6 rounded-full object-cover" />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        <Group title={t('Place')}>
          <SuggestField label={t('Country')} type="country" value={state.country} onChange={(v) => set('country', v)} />
          <SuggestField label={t('State')} type="state" value={state.state} onChange={(v) => set('state', v)} parent={{ country: state.country }} />
          <SuggestField label={t('City')} type="city" value={state.city} onChange={(v) => set('city', v)} parent={{ country: state.country, state: state.state }} />
        </Group>

        <Group title={t('Camera')}>
          <SuggestField label={t('Make')} type="camera-make" value={state.make} onChange={(v) => set('make', v)} />
          <SuggestField label={t('Model')} type="camera-model" value={state.model} onChange={(v) => set('model', v)} parent={{ make: state.make }} />
          <SuggestField label={t('Lens')} type="camera-lens-model" value={state.lensModel} onChange={(v) => set('lensModel', v)} />
        </Group>

        <Group title={t('Date')}>
          <DateField label={t('From')} value={state.takenAfter?.slice(0, 10) ?? ''} onChange={(v) => set('takenAfter', v ? new Date(v).toISOString() : undefined)} />
          <DateField label={t('To')} value={state.takenBefore?.slice(0, 10) ?? ''} onChange={(v) => set('takenBefore', v ? new Date(`${v}T23:59:59`).toISOString() : undefined)} />
        </Group>

        <Group title={t('Media type')}>
          <Select
            value={state.type ?? ''}
            onChange={(v) => set('type', (v || undefined) as SearchState['type'])}
            options={[
              { value: '', label: t('All') },
              { value: 'IMAGE', label: t('Photos') },
              { value: 'VIDEO', label: t('Videos') },
            ]}
          />
        </Group>

        {preferences.ratings.enabled && (
          <Group title={t('Rating')}>
            <StarRating value={state.rating ?? 0} onChange={(v) => set('rating', v || undefined)} />
          </Group>
        )}

        {(tags.data?.length ?? 0) > 0 && (
          <Group title={t('Tags')}>
            <div className="col-span-full flex max-h-28 flex-wrap gap-3 overflow-y-auto">
              {tags.data!.map((tag) => (
                <Checkbox key={tag.id} label={tag.value} checked={!!state.tagIds?.includes(tag.id)} onChange={() => toggleIn('tagIds', tag.id)} />
              ))}
            </div>
          </Group>
        )}

        <Group title={t('Display options')}>
          <Checkbox label={t('Not in any album')} checked={!!state.isNotInAlbum} onChange={(v) => set('isNotInAlbum', v || undefined)} />
          <Checkbox label={t('Include archived')} checked={!!state.withArchived} onChange={(v) => set('withArchived', v || undefined)} />
          <Checkbox label={t('Favorites only')} checked={!!state.isFavorite} onChange={(v) => set('isFavorite', v || undefined)} />
        </Group>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setState({ mode: state.mode })}>
            {t('Reset')}
          </Button>
          <Button type="submit" disabled={isEmptySearch(state)}>
            {t('Search')}
          </Button>
        </div>
      </form>
    </div>
  );
}
