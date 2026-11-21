// One Express worker that serves one OR SEVERAL API groups (core, timeline, media, upload, admin).
// WORKER_GROUPS=core,timeline,media makes a single process answer all three (see GROUP_MERGE in gateway/pool.js).
// Routers are imported only for the groups this process serves.
import http from 'node:http';
import { createApiApp } from './_api.js';
import { listen } from './_boot.js';
import { closeDb } from '../db.js';

const MOUNTS = {
  async core() {
    const [server, pub, auth, users, config, sessions, clusters, library, errorLogs] = await Promise.all([
      import('../routes/server.js'),
      import('../routes/public.js'),
      import('../routes/auth.js'),
      import('../routes/users.js'),
      import('../routes/config.js'),
      import('../routes/sessions.js'),
      import('../routes/cluster-groups.js'),
      import('../routes/library.js'),
      import('../routes/error-logs.js'),
    ]);
    return (api) => {
      api.use('/server', server.router);
      api.use('/public', pub.router);
      api.use('/auth', auth.router);
      api.use('/users', users.router);
      api.use('/config', config.router);
      api.use('/sessions', sessions.router);
      api.use('/cluster-groups', clusters.router);
      api.use(library.router);
      api.use('/error-logs', errorLogs.router);
    };
  },
  async timeline() {
    const { router } = await import('../routes/timeline.js');
    return (api) => api.use('/timeline', router);
  },
  async media() {
    const { router } = await import('../routes/assets.js'); // sharp is only loaded when a thumbnail is missing
    return (api) => api.use('/assets', router);
  },
  async upload() {
    const [chunked, upload] = await Promise.all([import('../routes/chunked-uploads.js'), import('../routes/assets-upload.js')]);
    return (api) => {
      api.use('/assets/chunked', chunked.router);
      api.use('/assets', upload.router);
    };
  },
  async admin() {
    const { router } = await import('../routes/admin.js');
    return (api) => api.use('/admin', router);
  },
};

const groups = (process.env.WORKER_GROUPS ?? '').split(',').filter(Boolean);
const unknown = groups.filter((g) => !MOUNTS[g]);
if (groups.length === 0 || unknown.length > 0) {
  console.error(`[api worker] bad WORKER_GROUPS "${process.env.WORKER_GROUPS}"`);
  process.exit(1);
}

const mounters = await Promise.all(groups.map((g) => MOUNTS[g]()));
const app = createApiApp((api) => mounters.forEach((mount) => mount(api)));
listen(http.createServer(app), { onClose: closeDb });
