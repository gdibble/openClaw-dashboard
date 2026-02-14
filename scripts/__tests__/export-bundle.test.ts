import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { exportBundle } from '../export-bundle';

let tmpDir: string;

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'openclaw-export-test-'));
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

describe('exportBundle', () => {
  it('creates bundle with correct structure', () => {
    writeJSON(tmpDir, 'task-1.json', { title: 'Task 1', status: 'done' });
    writeJSON(tmpDir, 'task-2.json', { title: 'Task 2', status: 'in-progress' });

    const bundle = exportBundle(tmpDir);

    expect(bundle).toHaveProperty('exportedAt');
    expect(bundle).toHaveProperty('taskCount', 2);
    expect(bundle).toHaveProperty('tasks');
    expect(bundle).toHaveProperty('agentsStatus');
    expect(bundle).toHaveProperty('feedItems');
    expect(bundle.tasks).toHaveLength(2);
    expect(bundle.agentsStatus).toBeNull();
    expect(bundle.feedItems).toBeNull();
  });

  it('separates agents-status.json from task files', () => {
    writeJSON(tmpDir, 'task-1.json', { title: 'Task 1' });
    writeJSON(tmpDir, 'agents-status.json', { neo: 'working', spark: 'idle' });

    const bundle = exportBundle(tmpDir);

    expect(bundle.taskCount).toBe(1);
    expect(bundle.agentsStatus).toEqual({ neo: 'working', spark: 'idle' });
  });

  it('separates feed-items.json from task files', () => {
    writeJSON(tmpDir, 'task-1.json', { title: 'Task 1' });
    writeJSON(tmpDir, 'feed-items.json', [{ id: 'f1', title: 'Feed item' }]);

    const bundle = exportBundle(tmpDir);

    expect(bundle.taskCount).toBe(1);
    expect(bundle.feedItems).toEqual([{ id: 'f1', title: 'Feed item' }]);
  });

  it('skips malformed JSON files', () => {
    writeJSON(tmpDir, 'good.json', { title: 'Good Task' });
    writeFileSync(join(tmpDir, 'bad.json'), '{ invalid json }}}');

    const bundle = exportBundle(tmpDir);

    expect(bundle.taskCount).toBe(1);
    expect(bundle.tasks[0]).toHaveProperty('title', 'Good Task');
  });

  it('respects file size limit (>1MB skipped)', () => {
    writeJSON(tmpDir, 'small.json', { title: 'Small' });
    const bigContent = JSON.stringify({ title: 'Big', data: 'x'.repeat(1_100_000) });
    writeFileSync(join(tmpDir, 'big.json'), bigContent);

    const bundle = exportBundle(tmpDir);

    expect(bundle.taskCount).toBe(1);
    expect(bundle.tasks[0]).toHaveProperty('title', 'Small');
  });

  it('throws when tasks directory does not exist', () => {
    expect(() => exportBundle('/tmp/nonexistent-dir-openclaw-test')).toThrow(
      'Tasks directory not found'
    );
  });

  it('skips non-task objects (arrays, objects without title)', () => {
    writeJSON(tmpDir, 'array.json', [1, 2, 3]);
    writeJSON(tmpDir, 'no-title.json', { status: 'done', id: 'x' });
    writeJSON(tmpDir, 'real.json', { title: 'Real Task' });

    const bundle = exportBundle(tmpDir);

    expect(bundle.taskCount).toBe(1);
    expect(bundle.tasks[0]).toHaveProperty('title', 'Real Task');
  });

  it('exportedAt is a valid ISO timestamp', () => {
    writeJSON(tmpDir, 'task.json', { title: 'Task' });

    const bundle = exportBundle(tmpDir);

    const parsed = new Date(bundle.exportedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
