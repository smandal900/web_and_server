import express from 'express';
import { logError } from '../routes/error-logs.js';

/** An Express app that only contains the routers its worker needs. `mount(api)` adds them. */
export function createApiApp(mount) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();
  mount(api);
  api.use((_req, res) => res.status(404).json({ message: 'Not found', statusCode: 404 }));
  app.use('/api', api);

  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error(err);
      logError({
        section: 'server',
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.originalUrl,
        status,
        userId: req.user?.id,
      });
    }
    res.status(status).json({ message: err.message || 'Internal server error', statusCode: status });
  });
  return app;
}
