// Upload calls: duplicate check, single-request upload with progress, resumable chunked upload.
import { ApiError, buildUrl, call } from './client';
import { E } from './endpoints';

export interface UploadMeta {
  fileCreatedAt: string;
  fileModifiedAt: string;
  isFavorite?: boolean;
  visibility?: string;
}
export const metaFromFile = (file: File): UploadMeta => ({
  fileCreatedAt: new Date(file.lastModified).toISOString(),
  fileModifiedAt: new Date(file.lastModified).toISOString(),
});

export interface UploadResult {
  id: string;
  status: 'created' | 'duplicate';
}

/** Ask which of these files the server already has (checksum = hex SHA-1). */
export const bulkUploadCheck = (assets: Array<{ id: string; checksum: string }>, key?: string) =>
  call<{ results: Array<{ id: string; action: 'accept' | 'reject'; reason?: string; assetId?: string }> }>(E.assets.bulkCheck, {
    body: { assets },
    query: { key },
  });

/** One multipart request. XMLHttpRequest is used (not fetch) because it reports upload progress. */
export function uploadSingle(file: File, meta: UploadMeta, onProgress: (fraction: number) => void, signal: AbortSignal, key?: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(E.assets.upload.path, {}, { key }));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, body.message ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error while uploading'));
    xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort());

    const form = new FormData();
    form.append('fileCreatedAt', meta.fileCreatedAt);
    form.append('fileModifiedAt', meta.fileModifiedAt);
    form.append('isFavorite', String(!!meta.isFavorite));
    if (meta.visibility) form.append('visibility', meta.visibility);
    form.append('assetData', file, file.name); // the file goes last so the server sees the fields first
    xhr.send(form);
  });
}

// --- chunked (large files, can resume after a failure) ---------------------
export interface ChunkedSession {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  /** The time on this device when the upload started. Every chunk of the upload is sent with it; the server ignores others. */
  timestamp: string;
}
export const createChunked = (file: File, meta: UploadMeta, key?: string) =>
  call<ChunkedSession>(E.assets.chunkedCreate, {
    // the timestamp comes from this device's clock, the server only compares it
    body: { filename: file.name, size: file.size, ...meta, timestamp: new Date().toISOString() },
    query: { key },
  });
export const getChunked = (id: string) => call<ChunkedSession>(E.assets.chunkedGet, { params: { id } });
export const deleteChunked = (id: string) => call(E.assets.chunkedDelete, { params: { id } });
export const CHUNK_TIMESTAMP_HEADER = 'x-chunk-timestamp';
export const putChunk = (session: ChunkedSession, index: number, data: Blob, signal: AbortSignal, key?: string) =>
  call(E.assets.chunkedPut, {
    params: { id: session.uploadId, index },
    body: data,
    signal,
    query: { key },
    headers: { [CHUNK_TIMESTAMP_HEADER]: session.timestamp },
  });
export const completeChunked = (id: string, key?: string) => call<UploadResult>(E.assets.chunkedComplete, { params: { id }, query: { key } });
