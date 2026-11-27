// The installable-app side. The service worker itself is public/sw.js; the cache names match.

/** Browsers allow installing and service workers only on https or localhost. */
export const canInstall = () => window.isSecureContext && 'serviceWorker' in navigator;
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches;

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}
let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** For useSyncExternalStore: the browser's "install this app" offer, when it has made one. */
export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const installOffered = () => !!prompt;
export async function install() {
  await prompt?.prompt();
  prompt = null; // an offer can be used once
  changed();
}

export function setUpPwa(production: boolean) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e as InstallPrompt;
    changed();
  });
  if (production && canInstall()) window.addEventListener('load', () => void navigator.serviceWorker.register('/app/sw.js').catch(() => undefined));
}

/** Pictures kept by the service worker belong to who was signed in. `all` also drops files waiting to be uploaded. */
export async function clearPrivateCaches(all = false) {
  if (!('caches' in window)) return;
  await Promise.all(['pwa-thumbs-v1', ...(all ? ['pwa-shared-v1'] : [])].map((name) => caches.delete(name))).catch(() => undefined);
}

/** The files shared to the installed app since the last call. */
export async function takeSharedFiles(): Promise<File[]> {
  if (!('caches' in window) || !(await caches.has('pwa-shared-v1'))) return [];
  const cache = await caches.open('pwa-shared-v1');
  const files: File[] = [];
  for (const key of await cache.keys()) {
    const response = await cache.match(key);
    // delete() says whether this call removed it, so two callers never upload the same file twice
    if (!response || !(await cache.delete(key))) continue;
    const name = decodeURIComponent(response.headers.get('x-file-name') ?? 'shared');
    files.push(new File([await response.blob()], name, { type: response.headers.get('content-type') ?? '', lastModified: Number(response.headers.get('x-modified')) || Date.now() }));
  }
  return files;
}
