// Every CREATE TABLE / migration in one place. It runs ONCE when the gateway starts (see migrate.js),
// not in every worker, so a worker that starts on demand does no schema work and starts faster.

/** @param {import('./db.js').db} db */
export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      is_onboarded  INTEGER NOT NULL DEFAULT 0,
      should_change_password INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      deleted_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      token_hash  TEXT NOT NULL UNIQUE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_type TEXT NOT NULL DEFAULT '',
      device_os   TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS error_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      level      TEXT NOT NULL DEFAULT 'error',
      source     TEXT NOT NULL DEFAULT 'web',
      section    TEXT NOT NULL DEFAULT '',
      message    TEXT NOT NULL,
      stack      TEXT,
      method     TEXT,
      path       TEXT,
      status     INTEGER,
      user_id    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);

    CREATE TABLE IF NOT EXISTS assets (
      id                 TEXT PRIMARY KEY,
      owner_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_file_name TEXT NOT NULL,
      original_path      TEXT NOT NULL,   -- relative to the library dir, or absolute when imported in place
      mime_type          TEXT NOT NULL,
      type               TEXT NOT NULL,   -- IMAGE | VIDEO
      checksum           TEXT NOT NULL,   -- SHA-1, lowercase hex
      file_size          INTEGER NOT NULL,
      file_created_at    TEXT NOT NULL,   -- UTC instant
      file_modified_at   TEXT NOT NULL,
      local_date_time    TEXT NOT NULL,   -- wall-clock time where it was taken, labelled as UTC
      local_offset_hours REAL NOT NULL DEFAULT 0,
      width              INTEGER,
      height             INTEGER,
      duration_ms        INTEGER,
      is_favorite        INTEGER NOT NULL DEFAULT 0,
      visibility         TEXT NOT NULL DEFAULT 'timeline',
      deleted_at         TEXT,
      thumbhash          TEXT,
      exif               TEXT,            -- JSON
      created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (owner_id, checksum)
    );
    CREATE INDEX IF NOT EXISTS idx_assets_timeline ON assets(owner_id, local_date_time DESC);

    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS chunked_uploads (
      id               TEXT PRIMARY KEY,
      owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename         TEXT NOT NULL,
      size             INTEGER NOT NULL,
      chunk_size       INTEGER NOT NULL,
      total_chunks     INTEGER NOT NULL,
      file_created_at  TEXT NOT NULL,
      file_modified_at TEXT NOT NULL,
      is_favorite      INTEGER NOT NULL DEFAULT 0,
      visibility       TEXT,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Migration: users belong to a cluster group (shared people); default is a group of one.
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'cluster_group_id')) {
    db.exec('ALTER TABLE users ADD COLUMN cluster_group_id TEXT');
  }
  db.exec('UPDATE users SET cluster_group_id = id WHERE cluster_group_id IS NULL');
}
