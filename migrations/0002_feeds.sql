CREATE TABLE feeds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL UNIQUE,
  feed_limit INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL
);

CREATE TABLE feed_status (
  feed_url   TEXT PRIMARY KEY,
  code       INTEGER,
  fetched_at TEXT,
  error      TEXT
);
