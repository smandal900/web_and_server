// The two last handlers of the API, shared by the worker processes and by single.js: an unknown URL, and any error
// thrown (or passed to next) by a route. Both write to the error log, so every failed request is visible to the admin.
import { logRequestFailure } from './log.js';

export function apiNotFound(req, res) {
  logRequestFailure(req, 404, new Error(`Not found: ${req.method} ${req.path}`));
  res.status(404).json({ message: 'Not found', statusCode: 404 });
}

export function apiErrorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (err.log !== false) logRequestFailure(req, status, err);
  // a response that already started (a failed download or stream) can only be cut off
  if (res.headersSent) return res.destroy(err);
  res.status(status).json({ message: err.message || 'Internal server error', statusCode: status });
}
