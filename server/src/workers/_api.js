import express from 'express';
import { apiErrorHandler, apiNotFound } from '../error-handler.js';
import { BODY_LIMIT } from '../util.js';

/** An Express app that only contains the routers its worker needs. `mount(api)` adds them. */
export function createApiApp(mount) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));

  const api = express.Router();
  mount(api);
  api.use(apiNotFound);
  app.use('/api', api);

  app.use(apiErrorHandler);
  return app;
}
