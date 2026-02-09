#!/usr/bin/env npx tsx
/**
 * log-usage.ts — Write token usage to PostgreSQL + task JSON files
 *
 * Usage:
 *   npx tsx scripts/log-usage.ts \
 *     --session-id <id> \
 *     --input <tokens> \
 *     --output <tokens> \
 *     [--model <name>] \
 *     [--provider <name>] \
 *     [--task-id <id>] \
 *     [--cache-read <tokens>] \
 *     [--cache-write <tokens>]
 *
 * Works in two modes:
 *   1. PostgreSQL mode: if DATABASE_URL is set, writes to token_usage table
 *   2. File mode: always writes/updates the task JSON file in OPENCLAW_TASKS_DIR
 *
 * Both modes run simultaneously — the dashboard picks up data from either path.
 */

import { Client } from 'pg';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Parse CLI args ──────────────────────────────────────────────────────
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const val = argv[i + 1];
    if (key && val) args[key] = val;
  }
  return args;
}

const args = parseArgs();
const sessionId = args['session-id'] || args['session_id'];
const inputTokens = parseInt(args['input'] || '0', 10);
const outputTokens = parseInt(args['output'] || '0', 10);
const cacheRead = args['cache-read'] ? parseInt(args['cache-read'], 10) : null;
const cacheWrite = args['cache-write'] ? parseInt(args['cache-write'], 10) : null;
const model = args['model'] || null;
const provider = args['provider'] || 'anthropic';
const taskId = args['task-id'] || args['task_id'] || null;

const DATABASE_URL = process.env.DATABASE_URL || '';
const TASKS_DIR = process.env.OPENCLAW_TASKS_DIR || './tasks';

if (!sessionId) {
  console.error('Error: --session-id is required');
  console.error('Usage: npx tsx scripts/log-usage.ts --session-id <id> --input <n> --output <n> [--model <m>] [--task-id <t>]');
  process.exit(1);
}

if (inputTokens === 0 && outputTokens === 0) {
  console.error('Error: --input and/or --output must be > 0');
  process.exit(1);
}

const usageEntry = {
  inputTokens,
  outputTokens,
  ...(cacheRead != null && { cacheReadTokens: cacheRead }),
  ...(cacheWrite != null && { cacheWriteTokens: cacheWrite }),
  ...(model && { model }),
  ...(provider && { provider }),
  timestamp: Date.now(),
};

// ── Write to PostgreSQL ─────────────────────────────────────────────────
async function writeToDb(): Promise<boolean> {
  if (!DATABASE_URL) return false;

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // Ensure table exists (idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        task_id TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        model TEXT,
        provider TEXT DEFAULT 'anthropic',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO token_usage (session_id, task_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, model, provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, taskId, inputTokens, outputTokens, cacheRead, cacheWrite, model, provider]
    );

    console.log(`DB: logged ${inputTokens}+${outputTokens} tokens for session ${sessionId}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`DB write skipped: ${msg}`);
    return false;
  } finally {
    await client.end();
  }
}

// ── Write to task JSON file ─────────────────────────────────────────────
function writeToFile(): boolean {
  try {
    if (!existsSync(TASKS_DIR)) {
      mkdirSync(TASKS_DIR, { recursive: true });
    }

    // Determine which file to update
    const fileId = taskId || `session-${sessionId}`;
    const filePath = join(TASKS_DIR, `${fileId}.json`);

    let task: Record<string, unknown>;

    if (existsSync(filePath)) {
      // Append to existing task file
      task = JSON.parse(readFileSync(filePath, 'utf-8'));
    } else {
      // Create minimal task file
      task = {
        id: fileId,
        title: `Session ${sessionId}`,
        description: `Auto-generated from token usage log`,
        status: 'in_progress',
        priority: 'normal',
        tags: ['session', 'auto'],
        created_at: new Date().toISOString(),
      };
    }

    // Append usage entry
    const existing = Array.isArray(task.usage) ? task.usage : [];
    task.usage = [...existing, usageEntry];
    task.updated_at = new Date().toISOString();

    writeFileSync(filePath, JSON.stringify(task, null, 2));
    console.log(`File: wrote usage to ${filePath}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`File write failed: ${msg}`);
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const [dbOk, fileOk] = await Promise.all([
    writeToDb(),
    Promise.resolve(writeToFile()),
  ]);

  if (!dbOk && !fileOk) {
    console.error('FATAL: Failed to write usage to both DB and file');
    process.exit(1);
  }

  const targets = [dbOk && 'PostgreSQL', fileOk && 'file'].filter(Boolean).join(' + ');
  console.log(`Usage logged to: ${targets}`);
}

main().catch(err => {
  console.error('log-usage failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
