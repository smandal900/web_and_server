// The upload queue. Add files from anywhere with `useUpload().addFiles(files)`.
//
// Every file goes through: hash (SHA-1, worker) -> duplicate check -> upload.
//   small file  -> one multipart request
//   large file  -> resumable chunks (a failed upload keeps its session, "retry" sends only missing chunks)
// At most MAX_PARALLEL files run at the same time.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/client';
import { addAssetsToAlbum } from '../api/library';
import {
  bulkUploadCheck,
  completeChunked,
  createChunked,
  deleteChunked,
  getChunked,
  metaFromFile,
  putChunk,
  uploadSingle,
  type ChunkedSession,
} from '../api/uploads';
import { useMediaTypes } from '../hooks/useServer';
import { CHUNKED_THRESHOLD, chunkRange, missingChunks } from '../lib/chunks';
import { sha1Hex } from '../lib/sha1';
import { useToast } from './ToastProvider';

export type UploadStatus = 'queued' | 'hashing' | 'checking' | 'uploading' | 'done' | 'duplicate' | 'error' | 'canceled';
export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0..1
  error?: string;
  assetId?: string;
  albumId?: string;
}

interface UploadApi {
  items: UploadItem[];
  addFiles: (files: File[], options?: { albumId?: string }) => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}
const UploadContext = createContext<UploadApi>(null!);
export const useUpload = () => useContext(UploadContext);

const MAX_PARALLEL = 2; // kept low on purpose: every running upload also costs the server memory
const ACTIVE: UploadStatus[] = ['hashing', 'checking', 'uploading'];

/** With `shareKey` (a public shared-link page), uploads are allowed by the link instead of by a login. */
export function UploadProvider({ children, shareKey }: { children: ReactNode; shareKey?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const mediaTypes = useMediaTypes().data;
  const [items, setItems] = useState<UploadItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const sessions = useRef(new Map<string, ChunkedSession>()); // chunk sessions kept for resume

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  /** The whole life of one upload. Never throws: failures become the item's `error`. */
  const process = useCallback(
    async (item: UploadItem) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      const { file, id } = item;
      try {
        patch(id, { status: 'hashing', progress: 0, error: undefined });
        const checksum = await sha1Hex(file);

        patch(id, { status: 'checking' });
        const check = (await bulkUploadCheck([{ id, checksum }], shareKey)).results[0];
        if (check?.action === 'reject') {
          patch(id, { status: 'duplicate', progress: 1, assetId: check.assetId });
          return;
        }

        patch(id, { status: 'uploading' });
        const meta = metaFromFile(file);
        let result;
        if (file.size < CHUNKED_THRESHOLD) {
          result = await uploadSingle(file, meta, (p) => patch(id, { progress: p }), controller.signal, shareKey);
        } else {
          let session = sessions.current.get(id);
          if (session) session = await getChunked(session.uploadId).catch(() => undefined); // resume
          if (!session) session = await createChunked(file, meta, shareKey);
          sessions.current.set(id, session);
          const todo = missingChunks(session.totalChunks, session.receivedChunks);
          let sent = session.totalChunks - todo.length;
          for (const index of todo) {
            const { start, end } = chunkRange(index, file.size, session.chunkSize);
            await putChunk(session.uploadId, index, file.slice(start, end), controller.signal, shareKey);
            patch(id, { progress: ++sent / session.totalChunks });
          }
          result = await completeChunked(session.uploadId, shareKey);
          sessions.current.delete(id);
        }

        patch(id, { status: result.status === 'duplicate' ? 'duplicate' : 'done', progress: 1, assetId: result.id });
        if (item.albumId) await addAssetsToAlbum(item.albumId, [result.id]).catch(() => undefined);
        qc.invalidateQueries({ queryKey: ['timeline'] });
      } catch (error) {
        if ((error as Error).name === 'AbortError') patch(id, { status: 'canceled' });
        else patch(id, { status: 'error', error: errorMessage(error) });
      } finally {
        controllers.current.delete(id);
      }
    },
    [patch, qc, shareKey],
  );

  // Start queued items whenever a slot is free.
  useEffect(() => {
    const running = items.filter((i) => ACTIVE.includes(i.status)).length;
    const queued = items.filter((i) => i.status === 'queued').slice(0, MAX_PARALLEL - running);
    for (const item of queued) {
      patch(item.id, { status: 'hashing' }); // claim it so it is not started twice
      void process(item);
    }
  }, [items, patch, process]);

  const addFiles = useCallback(
    (files: File[], options: { albumId?: string } = {}) => {
      const allowed = new Set([...(mediaTypes?.image ?? []), ...(mediaTypes?.video ?? [])]);
      const accepted: UploadItem[] = [];
      let skipped = 0;
      for (const file of files) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (allowed.size > 0 && !allowed.has(ext)) {
          skipped++;
          continue;
        }
        accepted.push({ id: crypto.randomUUID(), file, status: 'queued', progress: 0, albumId: options.albumId });
      }
      if (skipped) toast.error(`${skipped} file(s) skipped: unsupported type`);
      if (accepted.length) {
        setItems((list) => [...list, ...accepted]);
        setPanelOpen(true);
      }
    },
    [mediaTypes, toast],
  );

  const retry = useCallback((id: string) => patch(id, { status: 'queued', progress: 0, error: undefined }), [patch]);
  const cancel = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      const session = sessions.current.get(id);
      if (session) deleteChunked(session.uploadId).catch(() => undefined);
      sessions.current.delete(id);
      patch(id, { status: 'canceled' });
    },
    [patch],
  );
  const clearFinished = useCallback(
    () => setItems((list) => list.filter((i) => i.status === 'queued' || ACTIVE.includes(i.status))),
    [],
  );

  const value = useMemo(
    () => ({ items, addFiles, retry, cancel, clearFinished, panelOpen, setPanelOpen }),
    [items, addFiles, retry, cancel, clearFinished, panelOpen],
  );
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
