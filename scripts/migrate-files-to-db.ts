import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || '';
const TASKS_DIR = process.env.OPENCLAW_TASKS_DIR || './tasks';

function mapStatus(rawStatus: string): string {
  const s = rawStatus?.toLowerCase() || 'inbox';
  if (s === 'complete' || s === 'completed' || s === 'done' || s === 'approved') return 'done';
  if (s === 'in-progress' || s === 'in_progress' || s === 'active' || s === 'working') return 'in-progress';
  if (s === 'review' || s === 'submitted' || s === 'pending_review') return 'review';
  if (s === 'assigned' || s === 'claimed') return 'assigned';
  if (s === 'waiting' || s === 'blocked' || s === 'paused') return 'waiting';
  return 'inbox';
}

function mapPriority(rawPriority: string): number {
  const p = rawPriority?.toLowerCase() || 'normal';
  if (p === 'urgent' || p === 'p0' || p === 'critical') return 0;
  if (p === 'high' || p === 'p1') return 1;
  return 2;
}

function extractAssignee(task: Record<string, unknown>): string | null {
  if (task.claimed_by) return String(task.claimed_by);
  if (task.assignee) return String(task.assignee);
  const deliverables = task.deliverables as Array<Record<string, unknown>> | undefined;
  if (deliverables && deliverables.length > 0) {
    const firstAssignee = deliverables[0]?.assignee;
    if (firstAssignee) return String(firstAssignee);
  }
  return null;
}

function extractTags(task: Record<string, unknown>): string[] {
  if (Array.isArray(task.tags)) return task.tags.map(String);
  if (task.type) return [String(task.type)];
  return [];
}

async function migrate() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  if (!existsSync(TASKS_DIR)) {
    console.log('Tasks directory not found:', TASKS_DIR);
    process.exit(0);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const resolvedDir = resolve(TASKS_DIR);
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const fullPath = resolve(TASKS_DIR, file);
      if (!fullPath.startsWith(resolvedDir + '/')) { skipped++; continue; }

      const stats = statSync(fullPath);
      if (stats.size > 1_048_576) { skipped++; continue; }

      const content = readFileSync(fullPath, 'utf-8');
      const raw = JSON.parse(content);
      if (Array.isArray(raw) || typeof raw !== 'object' || raw === null || !raw.title) { skipped++; continue; }

      const task = raw as Record<string, unknown>;
      const id = String(task.id || file.replace('.json', ''));
      const createdAt = task.created_at ? new Date(String(task.created_at)) : new Date();
      const updatedAt = task.completed_at
        ? new Date(String(task.completed_at))
        : task.updated_at
          ? new Date(String(task.updated_at))
          : createdAt;

      await client.query(
        `INSERT INTO dashboard_tasks (id, title, description, status, priority, assignee_id, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          String(task.title || 'Untitled'),
          String(task.description || ''),
          mapStatus(task.status as string),
          mapPriority(task.priority as string),
          extractAssignee(task),
          extractTags(task),
          createdAt,
          updatedAt,
        ],
      );
      migrated++;
    } catch (err) {
      console.error(`Error migrating ${file}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  await client.end();
  console.log(`Migration complete: ${migrated} tasks migrated, ${skipped} skipped`);
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
