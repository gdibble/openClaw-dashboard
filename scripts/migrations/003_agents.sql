-- Dashboard agents — persistent agent registry
CREATE TABLE IF NOT EXISTS dashboard_agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  letter        CHAR(1) NOT NULL,
  color         TEXT NOT NULL DEFAULT '#697177',
  role          TEXT NOT NULL DEFAULT 'Agent',
  badge         TEXT CHECK (badge IN ('lead', 'spc', NULL)),
  status        TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('working', 'idle', 'offline')),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
