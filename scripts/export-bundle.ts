#!/usr/bin/env npx tsx
/**
 * export-bundle.ts — Nightly snapshot export
 *
 * Reads all task JSON from TASKS_DIR, separates tasks / agents / feed,
 * and writes a timestamped bundle to ./exports/.
 *
 * Usage:
 *   npx tsx scripts/export-bundle.ts [--output-dir <dir>] [--prefix <str>]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

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
const TASKS_DIR = process.env.OPENCLAW_TASKS_DIR || './tasks';
const OUTPUT_DIR = args['output-dir'] || './exports';
const PREFIX = args['prefix'] || 'openclaw-export';
const MAX_FILE_SIZE = 1_048_576; // 1 MB

// ── Main ────────────────────────────────────────────────────────────────
function exportBundle() {
  const resolvedDir = resolve(TASKS_DIR);
  if (!existsSync(resolvedDir)) {
    console.error(`Tasks directory not found: ${TASKS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(resolvedDir).filter(f => f.endsWith('.json'));
  const tasks: Record<string, unknown>[] = [];
  let agentsStatus: Record<string, string> | null = null;
  let feedItems: unknown[] | null = null;

  for (const file of files) {
    const fullPath = resolve(resolvedDir, file);

    // Path traversal protection
    if (!fullPath.startsWith(resolvedDir + '/')) {
      console.warn('Skipping path traversal attempt:', file);
      continue;
    }

    // File size limit
    const stats = statSync(fullPath);
    if (stats.size > MAX_FILE_SIZE) {
      console.warn(`Skipping oversized file: ${file} (${stats.size} bytes)`);
      continue;
    }

    try {
      const content = JSON.parse(readFileSync(fullPath, 'utf-8'));

      if (file === 'agents-status.json') {
        agentsStatus = content;
      } else if (file === 'feed-items.json') {
        feedItems = content;
      } else if (content && typeof content === 'object' && !Array.isArray(content) && content.title) {
        tasks.push(content);
      }
    } catch (err) {
      console.warn(`Skipping malformed JSON: ${file}`);
    }
  }

  // Build bundle
  const bundle = {
    exportedAt: new Date().toISOString(),
    taskCount: tasks.length,
    tasks,
    agentsStatus,
    feedItems,
  };

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = join(OUTPUT_DIR, `${PREFIX}-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(bundle, null, 2));

  console.log(`Exported ${tasks.length} tasks to ${outputPath}`);
  if (agentsStatus) console.log(`  Agent statuses: ${Object.keys(agentsStatus).length} agents`);
  if (feedItems) console.log(`  Feed items: ${(feedItems as unknown[]).length}`);
}

exportBundle();
