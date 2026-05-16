CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  pubkey     TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE settings (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO settings (id, value) VALUES (1, '{}');
