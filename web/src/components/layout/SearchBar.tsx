import { lazy, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { mdiClose, mdiMagnify, mdiTuneVariant } from '@mdi/js';
import { useShortcut } from '../../hooks/useShortcuts';
import { useFeatures } from '../../hooks/useServer';
import { t } from '../../i18n';
import { clearHistory, decodeFilters, readHistory, saveHistory, searchUrl } from '../../lib/search';
import { IconButton } from '../ui/Button';
import { Boundary } from '../ui/Boundary';

// The advanced-filter popup is only downloaded when someone opens it.
const SearchFilters = lazy(() => import('../search/SearchFilters'));

/** Navbar search: plain text on Enter, or the filter popup for everything else. */
export function SearchBar() {
  const navigate = useNavigate();
  const smart = useFeatures().data?.smartSearch;
  const [params] = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => decodeFilters(params.get('filters')).text ?? '');
  const [focused, setFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useShortcut('/', (e) => {
    e.preventDefault();
    input.current?.focus();
  });
  useEffect(() => setHistory(readHistory()), [focused]);

  const submit = (term: string) => {
    saveHistory(term);
    setFocused(false);
    input.current?.blur();
    // Without smart search on the server, plain text means "match the file name".
    navigate(searchUrl({ text: term, mode: smart ? 'smart' : 'filename' }));
  };

  return (
    <div className="relative w-full min-w-0 max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) submit(text.trim());
        }}
        className="flex items-center rounded-full bg-panel ring-1 ring-line focus-within:ring-2 focus-within:ring-primary"
      >
        <IconButton path={mdiMagnify} label={t('Search')} type="submit" />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t('Search your photos')}
          aria-label={t('Search')}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
        />
        {text && <IconButton path={mdiClose} label={t('Clear')} size={18} onClick={() => setText('')} />}
        <IconButton path={mdiTuneVariant} label={t('Search options')} active={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} />
      </form>

      {focused && !filtersOpen && history.length > 0 && !text && (
        <div className="absolute z-[8000] mt-1 w-full rounded-xl border border-line bg-bg py-2 shadow-xl">
          <div className="flex justify-between px-4 pb-1 text-xs text-muted">
            <span>{t('Recent searches')}</span>
            <button
              onMouseDown={() => {
                clearHistory();
                setHistory([]);
              }}
              className="text-primary"
            >
              {t('Clear all')}
            </button>
          </div>
          {history.map((h) => (
            <button key={h} onMouseDown={() => submit(h)} className="block w-full truncate px-4 py-2 text-left text-sm hover:bg-panel">
              {h}
            </button>
          ))}
        </div>
      )}

      {filtersOpen && (
        <Boundary compact>
          <SearchFilters
            initial={decodeFilters(params.get('filters'))}
            onClose={() => setFiltersOpen(false)}
            onSearch={(state) => {
              setFiltersOpen(false);
              setText(state.text ?? '');
              navigate(searchUrl(state));
            }}
          />
        </Boundary>
      )}
    </div>
  );
}
