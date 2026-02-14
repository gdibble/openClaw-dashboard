#!/usr/bin/env npx tsx
/**
 * executive-report.ts — Weekly executive markdown report
 *
 * Dual mode:
 *   - File mode (always): reads task JSONs from TASKS_DIR
 *   - PG mode (optional): queries handoffs, token_usage, sessions when DATABASE_URL is set
 *
 * Usage:
 *   npx tsx scripts/executive-report.ts [--days 7] [--output <path>] [--format md|json] [--no-db]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const MAX_FILE_SIZE = 1_048_576;

// ── Types ───────────────────────────────────────────────────────────────
export interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  claimed_by?: string;
  tags?: string[];
  created_at?: string;
  completed_at?: string;
  usage?: Array<{ inputTokens: number; outputTokens: number; model?: string }>;
}

export interface ReportData {
  period: { days: number; from: string; to: string };
  tasks: {
    total: number;
    done: number;
    inProgress: number;
    review: number;
    inbox: number;
    completionRate: string;
  };
  agents: Record<string, { tasks: number; completed: number }>;
  tokens: {
    total: number;
    byModel: Record<string, { input: number; output: number }>;
  };
  recentActivity: Array<{ date: string; title: string; status: string; agent: string }>;
  dbAvailable: boolean;
}

interface PgData {
  handoffCount: number;
  sessionCount: number;
  tokenRows: Array<{ input_tokens: number; output_tokens: number; model: string | null }>;
}

// ── Load tasks from disk ────────────────────────────────────────────────
export function loadTasksFromDisk(tasksDir: string): TaskData[] {
  const resolvedDir = resolve(tasksDir);
  if (!existsSync(resolvedDir)) return [];

  const files = readdirSync(resolvedDir).filter(f => f.endsWith('.json'));
  const tasks: TaskData[] = [];

  for (const file of files) {
    const fullPath = resolve(resolvedDir, file);
    if (!fullPath.startsWith(resolvedDir + '/')) continue;

    const stats = statSync(fullPath);
    if (stats.size > MAX_FILE_SIZE) continue;

    try {
      const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
      if (content && typeof content === 'object' && !Array.isArray(content) && content.title) {
        tasks.push(content as TaskData);
      }
    } catch { /* skip malformed */ }
  }

  return tasks;
}

// ── Load additional data from PG ────────────────────────────────────────
async function loadFromPg(skipDb: boolean, databaseUrl: string, days: number): Promise<PgData | null> {
  if (skipDb || !databaseUrl) return null;

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();

    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const handoffs = await client.query(
      'SELECT COUNT(*) as count FROM handoffs WHERE created_at >= $1', [cutoff]
    );
    const sessions = await client.query(
      'SELECT COUNT(*) as count FROM sessions WHERE started_at >= $1', [cutoff]
    );
    const tokens = await client.query(
      'SELECT input_tokens, output_tokens, model FROM token_usage WHERE created_at >= $1', [cutoff]
    );

    await client.end();
    return {
      handoffCount: parseInt(handoffs.rows[0].count, 10),
      sessionCount: parseInt(sessions.rows[0].count, 10),
      tokenRows: tokens.rows,
    };
  } catch (err) {
    console.warn('PG unavailable, continuing with file data only:', err instanceof Error ? err.message : 'Unknown error');
    try { await client.end(); } catch { /* already closed */ }
    return null;
  }
}

// ── Build report data ───────────────────────────────────────────────────
export function buildReport(tasks: TaskData[], pgData: PgData | null, days: number = 7): ReportData {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000);

  // Status counts
  const statusMap: Record<string, string> = {
    done: 'done', completed: 'done', complete: 'done', approved: 'done',
    'in-progress': 'inProgress', in_progress: 'inProgress', active: 'inProgress', working: 'inProgress',
    review: 'review', submitted: 'review', pending_review: 'review',
  };

  let done = 0, inProgress = 0, review = 0, inbox = 0;
  const agents: Record<string, { tasks: number; completed: number }> = {};
  const tokensByModel: Record<string, { input: number; output: number }> = {};
  let totalTokens = 0;

  for (const t of tasks) {
    const mapped = statusMap[t.status?.toLowerCase()] || 'inbox';
    if (mapped === 'done') done++;
    else if (mapped === 'inProgress') inProgress++;
    else if (mapped === 'review') review++;
    else inbox++;

    const agent = t.claimed_by || 'unassigned';
    if (!agents[agent]) agents[agent] = { tasks: 0, completed: 0 };
    agents[agent].tasks++;
    if (mapped === 'done') agents[agent].completed++;

    if (t.usage) {
      for (const u of t.usage) {
        const model = u.model || 'unknown';
        if (!tokensByModel[model]) tokensByModel[model] = { input: 0, output: 0 };
        tokensByModel[model].input += u.inputTokens || 0;
        tokensByModel[model].output += u.outputTokens || 0;
        totalTokens += (u.inputTokens || 0) + (u.outputTokens || 0);
      }
    }
  }

  // Merge PG token data if available
  if (pgData) {
    for (const row of pgData.tokenRows) {
      const model = row.model || 'unknown';
      if (!tokensByModel[model]) tokensByModel[model] = { input: 0, output: 0 };
      tokensByModel[model].input += row.input_tokens;
      tokensByModel[model].output += row.output_tokens;
      totalTokens += row.input_tokens + row.output_tokens;
    }
  }

  // Recent activity (last 10 tasks sorted by date)
  const sorted = [...tasks]
    .filter(t => t.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 10);

  const recentActivity = sorted.map(t => ({
    date: t.completed_at || t.created_at || '',
    title: t.title,
    status: t.status || 'unknown',
    agent: t.claimed_by || 'unassigned',
  }));

  const total = tasks.length;
  const completionRate = total > 0 ? ((done / total) * 100).toFixed(1) + '%' : '0%';

  return {
    period: { days, from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
    tasks: { total, done, inProgress, review, inbox, completionRate },
    agents,
    tokens: { total: totalTokens, byModel: tokensByModel },
    recentActivity,
    dbAvailable: pgData !== null,
  };
}

// ── Format as markdown ──────────────────────────────────────────────────
export function toMarkdown(report: ReportData): string {
  const lines: string[] = [];

  lines.push(`# OpenClaw Executive Report`);
  lines.push(`**Period:** ${report.period.from} to ${report.period.to} (${report.period.days} days)`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Task summary
  lines.push('## Task Summary');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total tasks | ${report.tasks.total} |`);
  lines.push(`| Completed | ${report.tasks.done} |`);
  lines.push(`| In Progress | ${report.tasks.inProgress} |`);
  lines.push(`| In Review | ${report.tasks.review} |`);
  lines.push(`| Inbox | ${report.tasks.inbox} |`);
  lines.push(`| **Completion Rate** | **${report.tasks.completionRate}** |`);
  lines.push('');

  // Agent performance
  lines.push('## Agent Performance');
  lines.push('| Agent | Tasks | Completed |');
  lines.push('|-------|-------|-----------|');
  for (const [agent, data] of Object.entries(report.agents)) {
    lines.push(`| ${agent} | ${data.tasks} | ${data.completed} |`);
  }
  lines.push('');

  // Token spend
  if (report.tokens.total > 0) {
    lines.push('## Token Spend');
    lines.push(`**Total:** ${report.tokens.total.toLocaleString()} tokens`);
    lines.push('');
    lines.push('| Model | Input | Output | Total |');
    lines.push('|-------|-------|--------|-------|');
    for (const [model, data] of Object.entries(report.tokens.byModel)) {
      const total = data.input + data.output;
      lines.push(`| ${model} | ${data.input.toLocaleString()} | ${data.output.toLocaleString()} | ${total.toLocaleString()} |`);
    }
    lines.push('');
  }

  // Recent activity
  if (report.recentActivity.length > 0) {
    lines.push('## Recent Activity');
    lines.push('| Date | Task | Status | Agent |');
    lines.push('|------|------|--------|-------|');
    for (const a of report.recentActivity) {
      const date = a.date ? a.date.slice(0, 10) : '-';
      lines.push(`| ${date} | ${a.title} | ${a.status} | ${a.agent} |`);
    }
    lines.push('');
  }

  if (!report.dbAvailable) {
    lines.push('---');
    lines.push('*Note: PostgreSQL was not available. Report generated from file data only.*');
    lines.push('');
  }

  return lines.join('\n');
}

// ── Parse CLI args ──────────────────────────────────────────────────────
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'no-db') {
      args['no-db'] = 'true';
      continue;
    }
    const val = argv[i + 1];
    if (key && val && !val.startsWith('--')) {
      args[key] = val;
      i++;
    }
  }
  return args;
}

// ── CLI main guard ──────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('executive-report.ts')) {
  const args = parseArgs();
  const tasksDir = process.env.OPENCLAW_TASKS_DIR || './tasks';
  const databaseUrl = process.env.DATABASE_URL || '';
  const days = parseInt(args['days'] || '7', 10);
  const outputPath = args['output'] || '';
  const format = args['format'] === 'json' ? 'json' : 'md';
  const skipDb = args['no-db'] === 'true';

  (async () => {
    const tasks = loadTasksFromDisk(tasksDir);
    const pgData = await loadFromPg(skipDb, databaseUrl, days);
    const report = buildReport(tasks, pgData, days);

    let output: string;
    if (format === 'json') {
      output = JSON.stringify(report, null, 2);
    } else {
      output = toMarkdown(report);
    }

    if (outputPath) {
      writeFileSync(outputPath, output);
      console.log(`Report written to ${outputPath}`);
    } else {
      console.log(output);
    }
  })();
}
