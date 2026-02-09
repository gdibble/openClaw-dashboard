-- Token usage tracking table
-- Stores per-API-call token counts linked to sessions and tasks

CREATE TABLE IF NOT EXISTS token_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT NOT NULL,
  task_id       TEXT,                          -- optional: links to a specific task file
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER,
  cache_write_tokens INTEGER,
  model         TEXT,                          -- e.g. "claude-opus-4", "claude-sonnet-4-5"
  provider      TEXT DEFAULT 'anthropic',      -- "anthropic", "openai", "custom"
  metadata      JSONB DEFAULT '{}',            -- extensible: cost, latency, tool_calls, etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookups by session (sync-db groups by session)
CREATE INDEX IF NOT EXISTS idx_token_usage_session
  ON token_usage (session_id);

-- Fast lookups by task (for per-task usage)
CREATE INDEX IF NOT EXISTS idx_token_usage_task
  ON token_usage (task_id) WHERE task_id IS NOT NULL;

-- Time-series queries for daily aggregation
CREATE INDEX IF NOT EXISTS idx_token_usage_created
  ON token_usage (created_at DESC);

-- Model breakdown queries
CREATE INDEX IF NOT EXISTS idx_token_usage_model
  ON token_usage (model) WHERE model IS NOT NULL;
