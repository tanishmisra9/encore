CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_expiry ON plans(expires_at);
