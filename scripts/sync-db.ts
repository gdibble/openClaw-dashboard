import { Client } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ensureTables } from './ensure-tables';

// ── Config ──────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/dbname';
const TASKS_DIR = process.env.OPENCLAW_TASKS_DIR || './tasks';
const HEARTBEAT_THRESHOLD_MIN = 5;

// ── Project → Agent ID mapping ──────────────────────────────────────────
// Map project directory paths to agent IDs
// Update these to match your local project directories
const PROJECT_MAP: Record<string, string> = {
  // '/path/to/project': 'agent-id',
};

function projectToAgent(project: string): string {
  return PROJECT_MAP[project] || 'continuous-claude';
}

// ── Types ───────────────────────────────────────────────────────────────
interface SessionRow {
  id: string;
  project: string;
  working_on: string | null;
  started_at: Date;
  last_heartbeat: Date;
}

interface HandoffRow {
  id: string;
  session_name: string;
  goal: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  created_at: Date;
  file_path: string;
}

interface FileClaimRow {
  file_path: string;
  project: string;
  session_id: string | null;
  claimed_at: Date;
}

interface ArchivalRow {
  id: string;
  session_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface TokenUsageRow {
  id: string;
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  model: string | null;
  provider: string | null;
  created_at: Date;
}

// ── Map DB rows to usage objects ─────────────────────────────────────────
function mapUsageRows(rows: TokenUsageRow[]): Array<Record<string, unknown>> {
  return rows.map(u => ({
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    ...(u.cache_read_tokens != null && { cacheReadTokens: u.cache_read_tokens }),
    ...(u.cache_write_tokens != null && { cacheWriteTokens: u.cache_write_tokens }),
    ...(u.model && { model: u.model }),
    ...(u.provider && { provider: u.provider }),
    timestamp: new Date(u.created_at).getTime(),
  }));
}

// ── Outcome → Task Status ───────────────────────────────────────────────
function outcomeToStatus(outcome: string | null): string {
  switch (outcome) {
    case 'SUCCEEDED': return 'done';
    case 'PARTIAL_PLUS': return 'review';
    case 'PARTIAL_MINUS': return 'waiting';
    case 'FAILED': return 'inbox';
    default: return 'inbox';
  }
}

function outcomeToPriority(outcome: string | null): string {
  switch (outcome) {
    case 'FAILED': return 'high';
    case 'PARTIAL_MINUS': return 'high';
    case 'PARTIAL_PLUS': return 'normal';
    case 'SUCCEEDED': return 'normal';
    default: return 'normal';
  }
}

// ── Connect with retry ───────────────────────────────────────────────────
async function connectWithRetry(client: Client, maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.connect();
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      console.warn(`PG connect attempt ${attempt}/${maxRetries} failed, retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── Main sync ───────────────────────────────────────────────────────────
async function sync() {
  const client = new Client({ connectionString: DATABASE_URL });
  await connectWithRetry(client);

  try {
    // Ensure tasks directory exists
    if (!existsSync(TASKS_DIR)) {
      mkdirSync(TASKS_DIR, { recursive: true });
    }

    // Auto-migrate: create token_usage table if missing
    await ensureTables(client);

    const now = new Date();
    const thresholdMs = HEARTBEAT_THRESHOLD_MIN * 60 * 1000;

    // ── 1. Sessions → Agent statuses + active work tasks ──────────────
    const sessionsResult = await client.query<SessionRow>(
      'SELECT id, project, working_on, started_at, last_heartbeat FROM sessions ORDER BY last_heartbeat DESC'
    );

    const agentStatuses: Record<string, string> = {};
    let taskIndex = 0;

    for (const session of sessionsResult.rows) {
      const agentId = projectToAgent(session.project);
      const isActive = (now.getTime() - new Date(session.last_heartbeat).getTime()) < thresholdMs;

      // Mark agent as working if any session is active
      if (isActive) {
        agentStatuses[agentId] = 'working';
      } else if (!agentStatuses[agentId]) {
        agentStatuses[agentId] = 'idle';
      }

      // Create task for active sessions with working_on
      if (isActive && session.working_on) {
        taskIndex++;
        // Fetch token usage for this session
        const usageResult = await client.query<TokenUsageRow>(
          `SELECT id, session_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, model, provider, created_at
           FROM token_usage WHERE session_id = $1 ORDER BY created_at DESC`,
          [session.id]
        );
        const usage = mapUsageRows(usageResult.rows);

        const task: Record<string, unknown> = {
          id: `session-${session.id}`,
          title: session.working_on,
          description: `Active session on ${session.project.split('/').pop()}`,
          status: 'in_progress',
          priority: 'normal',
          claimed_by: agentId,
          tags: ['session', 'active'],
          created_at: new Date(session.started_at).toISOString(),
          updated_at: new Date(session.last_heartbeat).toISOString(),
        };
        if (usage.length > 0) task.usage = usage;
        writeFileSync(
          join(TASKS_DIR, `session-${taskIndex}.json`),
          JSON.stringify(task, null, 2)
        );
      }
    }

    // Write agent statuses
    writeFileSync(
      join(TASKS_DIR, 'agents-status.json'),
      JSON.stringify(agentStatuses, null, 2)
    );

    // ── 2. Handoffs → Completed/review tasks ──────────────────────────
    const handoffsResult = await client.query<HandoffRow>(
      'SELECT id, session_name, goal, outcome, outcome_notes, created_at, file_path FROM handoffs ORDER BY created_at DESC LIMIT 50'
    );

    // Pre-fetch all token usage grouped by session_id
    const usageBySession: Record<string, Array<Record<string, unknown>>> = {};
    const allUsage = await client.query<TokenUsageRow>(
      `SELECT id, session_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, model, provider, created_at
       FROM token_usage ORDER BY created_at DESC`
    );
    for (const u of allUsage.rows) {
      if (!usageBySession[u.session_id]) usageBySession[u.session_id] = [];
      usageBySession[u.session_id].push(...mapUsageRows([u]));
    }

    for (let i = 0; i < handoffsResult.rows.length; i++) {
      const h = handoffsResult.rows[i];
      // Derive agent from file_path (handoffs are stored under project dirs)
      let agentId = 'continuous-claude';
      for (const [projectPath, aId] of Object.entries(PROJECT_MAP)) {
        if (h.file_path.includes(projectPath)) {
          agentId = aId;
          break;
        }
      }

      // Match usage by session_name (handoff session_name often matches session id)
      const usage = usageBySession[h.session_name] || [];

      const task: Record<string, unknown> = {
        id: `handoff-${h.id}`,
        title: h.goal || h.session_name || 'Untitled handoff',
        description: h.outcome_notes || '',
        status: outcomeToStatus(h.outcome),
        priority: outcomeToPriority(h.outcome),
        claimed_by: agentId,
        tags: ['handoff', h.outcome?.toLowerCase() || 'unknown'],
        created_at: new Date(h.created_at).toISOString(),
        completed_at: h.outcome === 'SUCCEEDED' ? new Date(h.created_at).toISOString() : undefined,
      };
      if (usage.length > 0) task.usage = usage;
      writeFileSync(
        join(TASKS_DIR, `handoff-${i + 1}.json`),
        JSON.stringify(task, null, 2)
      );
    }

    // ── 3. File claims → recent feed data ─────────────────────────────
    const claimsResult = await client.query<FileClaimRow>(
      'SELECT file_path, project, session_id, claimed_at FROM file_claims ORDER BY claimed_at DESC LIMIT 30'
    );

    const feedItems: Array<{
      id: string;
      type: string;
      title: string;
      agentId: string;
      timestamp: string;
    }> = [];

    for (const claim of claimsResult.rows) {
      const agentId = projectToAgent(claim.project);
      const fileName = claim.file_path.split('/').pop() || claim.file_path;
      feedItems.push({
        id: `claim-${claim.file_path.replace(/\//g, '-')}`,
        type: 'file_claim',
        title: `${agentId} claimed ${fileName}`,
        agentId,
        timestamp: new Date(claim.claimed_at).toISOString(),
      });
    }

    // ── 4. Archival memory → decision feed items ──────────────────────
    const memoryResult = await client.query<ArchivalRow>(
      'SELECT id, session_id, content, metadata, created_at FROM archival_memory ORDER BY created_at DESC LIMIT 20'
    );

    for (const mem of memoryResult.rows) {
      const preview = mem.content.length > 100 ? mem.content.slice(0, 100) + '...' : mem.content;
      feedItems.push({
        id: `memory-${mem.id}`,
        type: 'memory',
        title: preview,
        agentId: 'continuous-claude',
        timestamp: new Date(mem.created_at).toISOString(),
      });
    }

    // Write feed items
    if (feedItems.length > 0) {
      writeFileSync(
        join(TASKS_DIR, 'feed-items.json'),
        JSON.stringify(feedItems, null, 2)
      );
    }

    // ── Summary ───────────────────────────────────────────────────────
    const activeCount = Object.values(agentStatuses).filter(s => s === 'working').length;
    const totalTokens = allUsage.rows.reduce((s, u) => s + u.input_tokens + u.output_tokens, 0);
    console.log(`Sync complete:`);
    console.log(`  Sessions: ${sessionsResult.rows.length} (${activeCount} active)`);
    console.log(`  Handoffs: ${handoffsResult.rows.length}`);
    console.log(`  Token usage records: ${allUsage.rows.length} (${totalTokens.toLocaleString()} total tokens)`);
    console.log(`  File claims: ${claimsResult.rows.length}`);
    console.log(`  Memory items: ${memoryResult.rows.length}`);
    console.log(`  Agent statuses: ${JSON.stringify(agentStatuses)}`);

  } finally {
    await client.end();
  }
}

async function run() {
  while (true) {
    try {
      await sync();
      return;
    } catch (err) {
      console.error('Sync failed:', err instanceof Error ? err.message : 'Unknown error');
      console.log('Retrying in 30s...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

run();
