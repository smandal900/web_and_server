// The one table of "which router answers which URL", used by the worker processes (workers/api.js)
// and by the all-in-one server (single.js). Add a router here and both pick it up.
//
// Each row: [URL prefix under /api, module, name of the exported router]. The order inside a group matters.
// Routers are imported lazily, so a worker only loads the code of the groups it serves.
export const GROUPS = {
  core: [
    ['/server', './server.js', 'router'],
    ['/public', './public.js', 'router'],
    ['/auth', './auth.js', 'router'],
    ['/users', './users.js', 'router'],
    ['/config', './config.js', 'router'],
    ['/sessions', './sessions.js', 'router'],
    ['/cluster-groups', './cluster-groups.js', 'router'],
    ['/', './library.js', 'router'],
    ['/error-logs', './error-logs.js', 'router'],
    ['/albums', './albums.js', 'router'],
    ['/activities', './albums.js', 'activitiesRouter'],
    ['/people', './organize.js', 'peopleRouter'],
    ['/tags', './organize.js', 'tagsRouter'],
    ['/stacks', './organize.js', 'stacksRouter'],
    ['/partners', './sharing.js', 'partnersRouter'],
    ['/shared-links', './sharing.js', 'sharedLinksRouter'],
    ['/search', './discover.js', 'searchRouter'],
    ['/map', './discover.js', 'mapRouter'],
    ['/view', './discover.js', 'viewRouter'],
    ['/memories', './discover.js', 'memoriesRouter'],
    ['/trash', './discover.js', 'trashRouter'],
  ],
  timeline: [['/timeline', './timeline.js', 'router']],
  // reads and changes of existing assets; it must come before upload, because visitors of a shared link carry a key, not a login
  media: [
    ['/assets', './assets.js', 'router'],
    ['/download', './downloads.js', 'router'],
  ],
  upload: [
    ['/assets/chunked', './chunked-uploads.js', 'router'],
    ['/assets', './assets-upload.js', 'router'],
  ],
  admin: [['/admin', './admin.js', 'router']],
};

/** Import the routers of these groups: [[prefix, router], ...] */
export async function loadRoutes(groups) {
  const routes = [];
  for (const group of groups) {
    for (const [prefix, file, name] of GROUPS[group]) routes.push([prefix, (await import(file))[name]]);
  }
  return routes;
}

export const mountRoutes = (api, routes) => routes.forEach(([prefix, router]) => api.use(prefix, router));
