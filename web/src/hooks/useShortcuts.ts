import { useEffect, useRef } from 'react';

export interface ShortcutOptions {
  /** Modifier needed: 'shift' | 'ctrl' | 'alt'. */
  modifier?: 'shift' | 'ctrl' | 'alt';
  /** Run even while typing in an input (default false). */
  inInput?: boolean;
  enabled?: boolean;
}

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/**
 * Run `handler` when `key` is pressed (e.g. 'Escape', 'ArrowLeft', 'i').
 * The latest handler is always used, so callers can pass an inline function.
 */
export function useShortcut(key: string, handler: (e: KeyboardEvent) => void, options: ShortcutOptions = {}) {
  const latest = useRef(handler);
  latest.current = handler;
  const { modifier, inInput, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (!inInput && isTyping(e.target)) return;
      if (modifier === 'ctrl' ? !(e.ctrlKey || e.metaKey) : e.ctrlKey || e.metaKey) return;
      if (modifier === 'shift' ? !e.shiftKey : false) return;
      if (modifier === 'alt' ? !e.altKey : e.altKey) return;
      latest.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, modifier, inInput, enabled]);
}

/** The list shown in the "Keyboard shortcuts" dialog. Keep in sync with the hooks that use them. */
export const SHORTCUT_GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: 'General',
    items: [
      ['?', 'Show this help'],
      ['/', 'Focus the search box'],
      ['Esc', 'Close dialog, viewer or clear selection'],
    ],
  },
  {
    title: 'Photo list',
    items: [
      ['Click circle', 'Select a picture'],
      ['Shift + click', 'Select a range'],
      ['Ctrl + A', 'Select all loaded pictures'],
      ['Delete', 'Move selected to trash'],
      ['F', 'Favorite / unfavorite selected'],
      ['Shift + A', 'Archive selected'],
      ['D', 'Download selected'],
    ],
  },
  {
    title: 'Viewer',
    items: [
      ['← / →', 'Previous / next picture'],
      ['I', 'Show or hide details'],
      ['S', 'Start slideshow'],
      ['F', 'Favorite'],
      ['Delete', 'Move to trash'],
      ['Shift + A', 'Archive'],
      ['Esc', 'Close'],
    ],
  },
];
