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

  const addColumn = (table, column, ddl) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  };
  addColumn('chunked_uploads', 'device_timestamp', 'TEXT'); // time on the uploading device; every chunk must carry the same one
  addColumn('users', 'pin_hash', 'TEXT'); //                 locked folder PIN
  addColumn('users', 'profile_image_path', "TEXT NOT NULL DEFAULT ''"); // file name inside data/profile
  addColumn('sessions', 'elevated_at', 'TEXT'); //            set while the locked folder is unlocked
  addColumn('assets', 'stack_id', 'TEXT');
  addColumn('assets', 'edits', 'TEXT'); //                    JSON list of crop / rotate / mirror edits
  addColumn('assets', 'edit_width', 'INTEGER'); //            size after the edits are applied
  addColumn('assets', 'edit_height', 'INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id                  TEXT PRIMARY KEY,
      owner_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name                TEXT NOT NULL DEFAULT '',
      description         TEXT NOT NULL DEFAULT '',
      thumbnail_asset_id  TEXT,
      sort_order          TEXT NOT NULL DEFAULT 'desc',
      is_activity_enabled INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_albums_owner ON albums(owner_id);

    CREATE TABLE IF NOT EXISTS album_assets (
      album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (album_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_album_assets_asset ON album_assets(asset_id);

    CREATE TABLE IF NOT EXISTS album_users (
      album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role     TEXT NOT NULL DEFAULT 'editor',
      PRIMARY KEY (album_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_album_users_user ON album_users(user_id);

    CREATE TABLE IF NOT EXISTS activities (
      id         TEXT PRIMARY KEY,
      album_id   TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      asset_id   TEXT REFERENCES assets(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      comment    TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activities_album ON activities(album_id, created_at);

    CREATE TABLE IF NOT EXISTS people (
      id                 TEXT PRIMARY KEY,
      owner_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name               TEXT NOT NULL DEFAULT '',
      birth_date         TEXT,
      is_hidden          INTEGER NOT NULL DEFAULT 0,
      is_favorite        INTEGER NOT NULL DEFAULT 0,
      thumbnail_asset_id TEXT,
      created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS person_assets (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      asset_id  TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (person_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_person_assets_asset ON person_assets(asset_id);

    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value      TEXT NOT NULL,
      color      TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (owner_id, value)
    );
    CREATE TABLE IF NOT EXISTS tag_assets (
      tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (tag_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tag_assets_asset ON tag_assets(asset_id);

    CREATE TABLE IF NOT EXISTS stacks (
      id               TEXT PRIMARY KEY,
      owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      primary_asset_id TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assets_stack ON assets(stack_id);

    CREATE TABLE IF NOT EXISTS shared_links (
      id             TEXT PRIMARY KEY,
      key            TEXT NOT NULL UNIQUE,
      owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type           TEXT NOT NULL,              -- ALBUM | INDIVIDUAL
      album_id       TEXT REFERENCES albums(id) ON DELETE CASCADE,
      description    TEXT,
      password       TEXT,
      slug           TEXT UNIQUE,
      expires_at     TEXT,
      allow_upload   INTEGER NOT NULL DEFAULT 0,
      allow_download INTEGER NOT NULL DEFAULT 1,
      show_metadata  INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS shared_link_assets (
      link_id  TEXT NOT NULL REFERENCES shared_links(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (link_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS partners (
      shared_by_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      in_timeline    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (shared_by_id, shared_with_id)
    );
  `);
}
