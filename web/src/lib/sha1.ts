// Main-thread side of the hashing worker: one worker, jobs matched by id.
let worker: Worker | undefined;
const waiting = new Map<string, { resolve: (hex: string) => void; reject: (e: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./sha1.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: string; checksum?: string; error?: string }>) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if (event.data.checksum) job.resolve(event.data.checksum);
      else job.reject(new Error(event.data.error ?? 'Hashing failed'));
    };
  }
  return worker;
}

export function sha1Hex(file: File): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, file });
  });
}
