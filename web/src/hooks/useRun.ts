import { useCallback } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { useToast } from '../state/ToastProvider';

export interface RunOptions {
  /** Toast text on success. */
  success?: string;
  /** Query keys to refresh afterwards, e.g. [['albums'], ['timeline']]. */
  invalidate?: QueryKey[];
  /** Do not show an error toast (the caller handles it). */
  quiet?: boolean;
}
export type RunResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

/**
 * One place for "do something on the server and tell the user how it went".
 *
 *   const run = useRun();
 *   const result = await run(() => deleteAlbum(id), { success: 'Album deleted', invalidate: [['albums']] });
 *   if (result.ok) navigate('/albums');
 *
 * A feature the server does not support yet shows its friendly "not supported" message as an error toast.
 */
export function useRun() {
  const toast = useToast();
  const qc = useQueryClient();
  return useCallback(
    async <T,>(fn: () => Promise<T>, options: RunOptions = {}): Promise<RunResult<T>> => {
      try {
        const data = await fn();
        if (options.success) toast.success(options.success);
        for (const queryKey of options.invalidate ?? []) qc.invalidateQueries({ queryKey });
        return { ok: true, data };
      } catch (error) {
        if (!options.quiet) toast.error(errorMessage(error));
        return { ok: false, error };
      }
    },
    [toast, qc],
  );
}
