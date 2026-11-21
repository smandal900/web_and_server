import { createContext, useContext } from 'react';
import type { AdminConfig } from '../../../api/types';

/** The config being edited (a draft), the server's defaults, and a way to change one value by its path. */
export interface SettingsApi {
  config: AdminConfig;
  defaults: AdminConfig;
  /** set('ffmpeg.crf', 23) */
  set: (path: string, value: unknown) => void;
  /** The same value on the server right now (to show a "changed" marker). */
  saved: AdminConfig;
}

export const SettingsContext = createContext<SettingsApi>(null!);
export const useSettings = () => useContext(SettingsContext);

export const getPath = (obj: AdminConfig, path: string): unknown => path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);

/** A copy of `obj` with the value at `path` replaced (never mutates). */
export function setPath(obj: AdminConfig, path: string, value: unknown): AdminConfig {
  const [head, ...rest] = path.split('.');
  return { ...obj, [head]: rest.length === 0 ? value : setPath(obj[head] ?? {}, rest.join('.'), value) };
}
