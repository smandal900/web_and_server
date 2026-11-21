// Search filters live in the URL (/search?filters=...) so a search can be bookmarked, shared and reloaded.
import type { SearchFilters } from '../api/types';

export type TextMode = 'smart' | 'filename' | 'description' | 'ocr';
/** Filters as the UI edits them: SearchFilters plus how the free text is interpreted. */
export interface SearchState extends SearchFilters {
  mode?: TextMode;
  /** Text typed in the box; turned into query/originalFileName/description/ocr by `toRequest`. */
  text?: string;
  place?: string;
}

export const encodeFilters = (state: SearchState) => encodeURIComponent(JSON.stringify(state));

export function decodeFilters(raw: string | null): SearchState {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SearchState;
  } catch {
    return {};
  }
}

export const searchUrl = (state: SearchState) => `/search?filters=${encodeFilters(state)}`;

/** Convert the UI state to the body of a search request, and say whether the smart endpoint is needed. */
export function toRequest(state: SearchState): { body: SearchFilters; smart: boolean } {
  const { mode = 'smart', text, place: _place, ...rest } = state;
  const body: SearchFilters = { ...rest };
  let smart = false;
  if (text?.trim()) {
    if (mode === 'smart') {
      body.query = text.trim();
      smart = true;
    } else if (mode === 'filename') body.originalFileName = text.trim();
    else if (mode === 'description') body.description = text.trim();
    else body.ocr = text.trim();
  }
  return { body, smart };
}

/** True when nothing is filled in. */
export const isEmptySearch = (state: SearchState) =>
  Object.entries(state).every(([key, v]) => key === 'mode' || v === undefined || v === '' || (Array.isArray(v) && v.length === 0));

// --- recent searches (kept in this browser) ---
const HISTORY_KEY = 'search-history';
export function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}
export function saveHistory(term: string) {
  if (!term.trim()) return;
  const next = [term, ...readHistory().filter((h) => h !== term)].slice(0, 8);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
export const clearHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
};
