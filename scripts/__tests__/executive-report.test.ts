import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadTasksFromDisk, buildReport, toMarkdown, type TaskData } from '../executive-report';

let tmpDir: string;

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'openclaw-report-test-'));
}

function writeJSON(dir: string, filename: string, data: unknown) {
  writeFileSync(join(dir, filename), JSON.stringify(data));
}

beforeEach(() => {
  tmpDir = makeTmpDir();
});

afterEach(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
});

// ── loadTasksFromDisk ─────────────────────────────────────────────────

describe('loadTasksFromDisk', () => {
  it('loads valid task files', () => {
    writeJSON(tmpDir, 'task-1.json', { title: 'Task 1', status: 'done', id: '1', priority: 'high' });
    writeJSON(tmpDir, 'task-2.json', { title: 'Task 2', status: 'review', id: '2', priority: 'normal' });

    const tasks = loadTasksFromDisk(tmpDir);
    expect(tasks).toHaveLength(2);
  });

  it('skips non-task JSON (arrays, no title)', () => {
    writeJSON(tmpDir, 'array.json', [1, 2, 3]);
    writeJSON(tmpDir, 'no-title.json', { id: 'x' });
    writeJSON(tmpDir, 'valid.json', { title: 'Valid', id: 'v', status: 'done', priority: 'normal' });

    const tasks = loadTasksFromDisk(tmpDir);
    expect(tasks).toHaveLength(1);
  });

  it('returns empty array when directory does not exist', () => {
    const tasks = loadTasksFromDisk('/tmp/nonexistent-openclaw-test');
    expect(tasks).toEqual([]);
  });
});

// ── buildReport ──────────────────────────────────────────────────────

describe('buildReport', () => {
  it('computes correct status counts and completion rate', () => {
    const tasks: TaskData[] = [
      { id: '1', title: 'T1', status: 'done', priority: 'normal' },
      { id: '2', title: 'T2', status: 'completed', priority: 'normal' },
      { id: '3', title: 'T3', status: 'in-progress', priority: 'high' },
      { id: '4', title: 'T4', status: 'review', priority: 'normal' },
      { id: '5', title: 'T5', status: 'new', priority: 'normal' },
    ];

    const report = buildReport(tasks, null);

    expect(report.tasks.total).toBe(5);
    expect(report.tasks.done).toBe(2);
    expect(report.tasks.inProgress).toBe(1);
    expect(report.tasks.review).toBe(1);
    expect(report.tasks.inbox).toBe(1);
    expect(report.tasks.completionRate).toBe('40.0%');
  });

  it('aggregates tokens by model', () => {
    const tasks: TaskData[] = [
      {
        id: '1', title: 'T1', status: 'done', priority: 'normal',
        usage: [
          { inputTokens: 1000, outputTokens: 500, model: 'claude-3' },
          { inputTokens: 2000, outputTokens: 800, model: 'gpt-4' },
        ],
      },
      {
        id: '2', title: 'T2', status: 'done', priority: 'normal',
        usage: [
          { inputTokens: 500, outputTokens: 200, model: 'claude-3' },
        ],
      },
    ];

    const report = buildReport(tasks, null);

    expect(report.tokens.byModel['claude-3']).toEqual({ input: 1500, output: 700 });
    expect(report.tokens.byModel['gpt-4']).toEqual({ input: 2000, output: 800 });
    expect(report.tokens.total).toBe(1000 + 500 + 2000 + 800 + 500 + 200);
  });

  it('tracks per-agent task and completed counts', () => {
    const tasks: TaskData[] = [
      { id: '1', title: 'T1', status: 'done', priority: 'normal', claimed_by: 'neo' },
      { id: '2', title: 'T2', status: 'in-progress', priority: 'normal', claimed_by: 'neo' },
      { id: '3', title: 'T3', status: 'done', priority: 'normal', claimed_by: 'spark' },
      { id: '4', title: 'T4', status: 'review', priority: 'normal' }, // unassigned
    ];

    const report = buildReport(tasks, null);

    expect(report.agents['neo']).toEqual({ tasks: 2, completed: 1 });
    expect(report.agents['spark']).toEqual({ tasks: 1, completed: 1 });
    expect(report.agents['unassigned']).toEqual({ tasks: 1, completed: 0 });
  });

  it('handles empty task list gracefully', () => {
    const report = buildReport([], null);

    expect(report.tasks.total).toBe(0);
    expect(report.tasks.done).toBe(0);
    expect(report.tasks.completionRate).toBe('0%');
    expect(report.agents).toEqual({});
    expect(report.tokens.total).toBe(0);
    expect(report.recentActivity).toEqual([]);
    expect(report.dbAvailable).toBe(false);
  });

  it('uses custom days parameter', () => {
    const report = buildReport([], null, 14);
    expect(report.period.days).toBe(14);
  });

  it('maps all status variants correctly', () => {
    const tasks: TaskData[] = [
      { id: '1', title: 'T1', status: 'approved', priority: 'normal' },     // → done
      { id: '2', title: 'T2', status: 'complete', priority: 'normal' },     // → done
      { id: '3', title: 'T3', status: 'active', priority: 'normal' },       // → inProgress
      { id: '4', title: 'T4', status: 'working', priority: 'normal' },      // → inProgress
      { id: '5', title: 'T5', status: 'submitted', priority: 'normal' },    // → review
      { id: '6', title: 'T6', status: 'pending_review', priority: 'normal' }, // → review
      { id: '7', title: 'T7', status: 'something_else', priority: 'normal' }, // → inbox
    ];

    const report = buildReport(tasks, null);

    expect(report.tasks.done).toBe(2);
    expect(report.tasks.inProgress).toBe(2);
    expect(report.tasks.review).toBe(2);
    expect(report.tasks.inbox).toBe(1);
  });
});

// ── toMarkdown ──────────────────────────────────────────────────────

describe('toMarkdown', () => {
  it('produces valid markdown with all sections', () => {
    const tasks: TaskData[] = [
      {
        id: '1', title: 'Task One', status: 'done', priority: 'high',
        claimed_by: 'neo', created_at: '2026-01-10T10:00:00Z',
        usage: [{ inputTokens: 1000, outputTokens: 500, model: 'claude-3' }],
      },
      {
        id: '2', title: 'Task Two', status: 'in-progress', priority: 'normal',
        claimed_by: 'spark', created_at: '2026-01-12T10:00:00Z',
      },
    ];

    const report = buildReport(tasks, null);
    const md = toMarkdown(report);

    expect(md).toContain('# OpenClaw Executive Report');
    expect(md).toContain('## Task Summary');
    expect(md).toContain('## Agent Performance');
    expect(md).toContain('## Token Spend');
    expect(md).toContain('## Recent Activity');
    expect(md).toContain('| neo |');
    expect(md).toContain('| spark |');
    expect(md).toContain('claude-3');
    expect(md).toContain('*Note: PostgreSQL was not available');
  });

  it('omits Token Spend section when no tokens', () => {
    const report = buildReport(
      [{ id: '1', title: 'T', status: 'done', priority: 'normal' }],
      null,
    );
    const md = toMarkdown(report);

    expect(md).not.toContain('## Token Spend');
  });

  it('omits Recent Activity when no tasks have dates', () => {
    const report = buildReport(
      [{ id: '1', title: 'T', status: 'done', priority: 'normal' }],
      null,
    );
    const md = toMarkdown(report);

    // Tasks without created_at are filtered out of recentActivity
    expect(md).not.toContain('## Recent Activity');
  });

  it('handles empty report', () => {
    const report = buildReport([], null);
    const md = toMarkdown(report);

    expect(md).toContain('# OpenClaw Executive Report');
    expect(md).toContain('| Total tasks | 0 |');
    expect(md).toContain('**0%**');
  });
});
