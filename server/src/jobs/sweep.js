// One-shot job started by the gateway every few hours: delete abandoned chunked uploads, then exit.
// Running it as its own short-lived process means the upload worker does not have to stay alive for the timer.
import { closeDb } from '../db.js';
import { sweepExpiredUploads } from '../chunk-sweep.js';

try {
  await sweepExpiredUploads();
} catch (error) {
  console.warn(`[sweep] could not clean old uploads: ${error.message}`);
} finally {
  closeDb();
}
