import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_PATH } from './paths.js';
import { migrate } from './schema.js';

export { DATA_DIR };

/**
 * Node's built-in SQLite (no native addon to compile, nothing extra in RAM).
 * This thin wrapper keeps the small better-sqlite3-style API the routes use:
 * prepare().run/get/all, exec, pragma, open, close.
 */
class Db {
  constructor(file) {
    this.raw = new DatabaseSync(file);
    this.open = true;
  }
  pragma(text) {
    return this.raw.prepare(`PRAGMA ${text}`).all();
  }
  exec(sql) {
    this.raw.exec(sql);
    return this;
  }
  prepare(sql) {
    const st = this.raw.prepare(sql);
    return { run: (...a) => st.run(...a), get: (...a) => st.get(...a), all: (...a) => st.all(...a) };
  }
  /** Run fn inside one transaction: one disk sync for a whole batch instead of one per statement. */
  transaction(fn) {
    this.raw.exec('BEGIN');
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.open = false;
    this.raw.close();
  }
}

export const db = new Db(DB_PATH);
db.pragma('journal_mode = WAL'); // several worker processes read and write the same file
db.pragma('busy_timeout = 10000'); // wait for another worker's write instead of failing
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // safe with WAL, far fewer fsyncs
// Memory: a small page cache per process (value in KiB), no memory-mapped file, temp tables on disk.
db.pragma(`cache_size = -${Number(process.env.SQLITE_CACHE_KB) || 1024}`);
db.pragma('mmap_size = 0');
db.pragma('temp_store = FILE');

// The gateway migrates once at boot and tells workers to skip it. CLI scripts and single.js still migrate.
if (process.env.SKIP_MIGRATE !== '1') migrate(db);

export const closeDb = () => {
  if (db.open) db.close();
};
