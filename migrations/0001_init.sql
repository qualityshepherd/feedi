CREATE TABLE posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  markdown    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  type        TEXT NOT NULL DEFAULT 'post',
  date        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  author      TEXT NOT NULL,
  audio_url   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE members (
  pubkey     TEXT PRIMARY KEY,
  token      TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_posts_slug    ON posts(slug);
CREATE INDEX idx_posts_status  ON posts(status);
CREATE INDEX idx_post_tags_tag ON post_tags(tag);
