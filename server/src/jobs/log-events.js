// One-shot helper started by the gateway when it has something to report (see gateway/event-log.js):
// receives a list of events, writes them to the error log, and exits.
import { closeDb } from '../db.js';
import { logEvent } from '../log.js';

setTimeout(() => process.exit(1), 10_000).unref(); // never linger if the gateway sent nothing

process.once('message', (message) => {
  for (const event of Array.isArray(message?.events) ? message.events : []) logEvent(event);
  closeDb();
  process.exit(0);
});
