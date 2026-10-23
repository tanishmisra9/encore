CREATE TABLE IF NOT EXISTS pending_locations (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS pending_locations_expiry ON pending_locations(expires_at);
