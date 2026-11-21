// One-shot: create / upgrade the database, then exit. The gateway runs this at boot so it frees its RAM right away.
import { closeDb, db } from './db.js';
import { migrate } from './schema.js';

migrate(db); // db.js already migrates unless SKIP_MIGRATE is set; calling again is harmless and explicit
closeDb();
