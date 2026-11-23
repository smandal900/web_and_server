import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPreferences, updatePreferences } from '../api/core';
import type { Preferences } from '../api/types';
import { useAuth } from '../state/AuthProvider';

export const DEFAULT_PREFERENCES: Preferences = {
  albums: { defaultAssetOrder: 'desc' },
  cast: { gCastEnabled: false },
  download: { archiveSize: 4294967296, includeEmbeddedVideos: false },
  folders: { enabled: false, sidebarWeb: false },
  memories: { enabled: true, duration: 5 },
  people: { enabled: true, sidebarWeb: false },
  purchase: { showSupportBadge: true, hideBuyButtonUntil: '2022-02-12T00:00:00.000Z' },
  ratings: { enabled: false },
  recentlyAdded: { sidebarWeb: false },
  sharedLinks: { enabled: true, sidebarWeb: false },
  tags: { enabled: false, sidebarWeb: false },
};

type Json = Record<string, any>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base: Json, patch: Json): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isObject(value) && isObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

// The server may ignore preference changes (it answers with defaults). So each choice is also kept in
// this browser and laid over whatever the server returns. When the server starts saving preferences
// the two agree and nothing visible changes.
const storageKey = (userId?: string) => `preferences:${userId ?? 'anonymous'}`;
function readLocal(userId?: string): Json {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}');
  } catch {
    return {};
  }
}

/** The signed-in user's preferences plus a function to change them. Always returns usable values. */
export function usePreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['preferences', user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const server = await getPreferences().catch(() => DEFAULT_PREFERENCES);
      return deepMerge(server, readLocal(user?.id)) as Preferences;
    },
  });
  const preferences = query.data ?? DEFAULT_PREFERENCES;

  /** Change some preferences, e.g. update({ memories: { enabled: false } }). */
  const update = async (patch: Json) => {
    const next = deepMerge(preferences, patch) as Preferences;
    qc.setQueryData(key, next);
    try {
      localStorage.setItem(storageKey(user?.id), JSON.stringify(deepMerge(readLocal(user?.id), patch)));
    } catch {
      /* private mode: the change lasts until reload */
    }
    await updatePreferences(patch).catch(() => undefined); // best effort; see comment above
  };

  return { preferences, update, isLoading: query.isLoading };
}
