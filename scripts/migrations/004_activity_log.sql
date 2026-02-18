-- Activity log — event stream for feed and audit
CREATE TABLE IF NOT EXISTS activity_log (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  agent_id      TEXT,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_event ON activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent ON activity_log (agent_id) WHERE agent_id IS NOT NULL;
