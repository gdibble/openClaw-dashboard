-- Task extras — checklists, comments, deliverables, operator sessions

CREATE TABLE IF NOT EXISTS task_checklist (
  id          BIGSERIAL PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES dashboard_tasks(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  checked     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON task_checklist (task_id, sort_order);

CREATE TABLE IF NOT EXISTS task_comments (
  id          BIGSERIAL PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES dashboard_tasks(id) ON DELETE CASCADE,
  author      TEXT NOT NULL DEFAULT 'operator',
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS task_deliverables (
  id          BIGSERIAL PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES dashboard_tasks(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'link'
);

CREATE INDEX IF NOT EXISTS idx_task_deliverables_task ON task_deliverables (task_id);

CREATE TABLE IF NOT EXISTS operator_sessions (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_expires ON operator_sessions (expires_at);
