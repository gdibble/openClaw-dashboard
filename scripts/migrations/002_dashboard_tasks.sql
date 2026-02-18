-- Dashboard tasks — core task storage for v2
CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'inbox'
                CHECK (status IN ('inbox','assigned','in-progress','review','waiting','done')),
  priority      SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (0, 1, 2)),
  assignee_id   TEXT,
  tags          TEXT[] DEFAULT '{}',
  parent_id     TEXT REFERENCES dashboard_tasks(id) ON DELETE SET NULL,
  sort_order    REAL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status ON dashboard_tasks (status);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_assignee ON dashboard_tasks (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_parent ON dashboard_tasks (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_created ON dashboard_tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_sort ON dashboard_tasks (status, sort_order);
