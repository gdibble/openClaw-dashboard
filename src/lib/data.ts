import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { Agent, Task, FeedItem, TaskStatus, Priority } from '@/types';

const TASKS_DIR = process.env.OPENCLAW_TASKS_DIR || './tasks';

// ── Color Validation ──────────────────────────────────────────────────
function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#697177';
}

// ── Default Agent Roster ─────────────────────────────────────────────
export const AGENTS: Agent[] = [
  { id: 'neo', name: 'Neo', letter: 'N', color: sanitizeColor('#46a758'), role: 'Squad Lead', status: 'idle', badge: 'lead' },
  { id: 'spark', name: 'Spark', letter: 'S', color: sanitizeColor('#ffb224'), role: 'Code & Writing', status: 'idle', badge: 'spc' },
  { id: 'pixel', name: 'Pixel', letter: 'P', color: sanitizeColor('#e879a4'), role: 'Design & UI', status: 'idle', badge: 'spc' },
  { id: 'scout', name: 'Scout', letter: 'R', color: sanitizeColor('#3e63dd'), role: 'Research', status: 'idle', badge: 'spc' },
  { id: 'critic', name: 'Critic', letter: 'C', color: sanitizeColor('#8e4ec6'), role: 'Review & QA', status: 'idle' },
  { id: 'sentinel', name: 'Sentinel', letter: 'T', color: sanitizeColor('#00a2c7'), role: 'Security', status: 'idle' },
];

// ── Dynamic Agent Status ─────────────────────────────────────────────
export function getAgents(): Agent[] {
  const statusPath = join(TASKS_DIR, 'agents-status.json');
  if (!existsSync(statusPath)) return AGENTS;

  try {
    const raw = JSON.parse(readFileSync(statusPath, 'utf-8')) as Record<string, string>;
    return AGENTS.map(agent => ({
      ...agent,
      status: (raw[agent.id] === 'working' ? 'working' : 'idle') as Agent['status'],
    }));
  } catch {
    return AGENTS;
  }
}

// ── Status Mapping ─────────────────────────────────────────────────────
function mapStatus(rawStatus: string): TaskStatus {
  const s = rawStatus?.toLowerCase() || 'inbox';
  if (s === 'complete' || s === 'completed' || s === 'done' || s === 'approved') return 'done';
  if (s === 'in-progress' || s === 'in_progress' || s === 'active' || s === 'working') return 'in-progress';
  if (s === 'review' || s === 'submitted' || s === 'pending_review') return 'review';
  if (s === 'assigned' || s === 'claimed') return 'assigned';
  if (s === 'waiting' || s === 'blocked' || s === 'paused') return 'waiting';
  return 'inbox';
}

// ── Priority Mapping ───────────────────────────────────────────────────
function mapPriority(rawPriority: string): Priority {
  const p = rawPriority?.toLowerCase() || 'normal';
  if (p === 'urgent' || p === 'p0' || p === 'critical') return 0;
  if (p === 'high' || p === 'p1') return 1;
  return 2;
}

// ── Parse Date ─────────────────────────────────────────────────────────
function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

// ── Extract Assignee ───────────────────────────────────────────────────
function extractAssignee(task: Record<string, unknown>): string | undefined {
  // Check various fields where assignee might be
  if (task.claimed_by) return String(task.claimed_by);
  if (task.assignee) return String(task.assignee);
  
  // Check deliverables for primary assignee
  const deliverables = task.deliverables as Array<Record<string, unknown>> | undefined;
  if (deliverables && deliverables.length > 0) {
    const firstAssignee = deliverables[0]?.assignee;
    if (firstAssignee) return String(firstAssignee);
  }
  
  return undefined;
}

// ── Extract Tags ───────────────────────────────────────────────────────
function extractTags(task: Record<string, unknown>): string[] {
  if (Array.isArray(task.tags)) return task.tags.map(String);
  if (task.type) return [String(task.type)];
  return [];
}

// ── Load Tasks ─────────────────────────────────────────────────────────
export function loadTasks(): Task[] {
  if (!existsSync(TASKS_DIR)) {
    console.warn('Tasks directory not found:', TASKS_DIR);
    return [];
  }

  const resolvedDir = resolve(TASKS_DIR);
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
  const tasks: Task[] = [];

  for (const file of files) {
    try {
      const fullPath = resolve(TASKS_DIR, file);
      if (!fullPath.startsWith(resolvedDir + '/')) {
        console.warn('Skipping path traversal attempt:', file);
        continue;
      }

      const stats = statSync(fullPath);
      if (stats.size > 1_048_576) {
        console.warn(`Skipping oversized task file: ${file} (${stats.size} bytes)`);
        continue;
      }

      const content = readFileSync(fullPath, 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>;
      
      tasks.push({
        id: String(raw.id || file.replace('.json', '')),
        title: String(raw.title || 'Untitled'),
        description: String(raw.description || ''),
        status: mapStatus(raw.status as string),
        priority: mapPriority(raw.priority as string),
        assigneeId: extractAssignee(raw),
        tags: extractTags(raw),
        createdAt: parseDate(raw.created_at as string || raw.created as string),
        updatedAt: parseDate(raw.completed_at as string || raw.completed as string || raw.updated_at as string),
      });
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }

  // Sort by createdAt descending (newest first)
  tasks.sort((a, b) => b.createdAt - a.createdAt);
  
  return tasks;
}

// ── Generate Feed from Tasks ───────────────────────────────────────────
export function generateFeed(tasks: Task[]): FeedItem[] {
  const feed: FeedItem[] = [];
  const now = Date.now();
  
  // Generate feed items from recent task activity
  for (const task of tasks.slice(0, 20)) {
    if (task.status === 'done' && task.updatedAt) {
      feed.push({
        id: `${task.id}-complete`,
        type: 'task',
        severity: 'success',
        title: `${task.assigneeId ? capitalize(task.assigneeId) : 'Someone'} completed "${task.title}"`,
        agentId: task.assigneeId,
        timestamp: task.updatedAt,
      });
    } else if (task.status === 'in-progress') {
      feed.push({
        id: `${task.id}-progress`,
        type: 'task',
        severity: 'info',
        title: `${task.assigneeId ? capitalize(task.assigneeId) : 'Someone'} started "${task.title}"`,
        agentId: task.assigneeId,
        timestamp: task.createdAt,
      });
    } else if (task.status === 'review') {
      feed.push({
        id: `${task.id}-review`,
        type: 'task',
        severity: 'info',
        title: `"${task.title}" submitted for review`,
        agentId: task.assigneeId,
        timestamp: task.updatedAt || task.createdAt,
      });
    }
  }

  // Merge feed items from bridge script (file claims, memory entries)
  const feedPath = join(TASKS_DIR, 'feed-items.json');
  if (existsSync(feedPath)) {
    try {
      const rawFeed = JSON.parse(readFileSync(feedPath, 'utf-8')) as Array<{
        id: string; type: string; title: string; agentId?: string; timestamp: string;
      }>;
      for (const item of rawFeed.slice(0, 10)) {
        feed.push({
          id: item.id,
          type: item.type === 'memory' ? 'decision' : 'comment',
          severity: item.type === 'memory' ? 'info' : 'info',
          title: item.title,
          agentId: item.agentId,
          timestamp: new Date(item.timestamp).getTime(),
        });
      }
    } catch { /* ignore malformed feed file */ }
  }

  // Add a status item
  const agents = getAgents();
  const workingAgents = agents.filter(a => a.status === 'working').length;
  feed.unshift({
    id: 'status-now',
    type: 'status',
    severity: 'success',
    title: `Squad active — ${workingAgents} ${workingAgents === 1 ? 'project' : 'projects'} online`,
    timestamp: now,
  });

  // Sort by timestamp descending
  feed.sort((a, b) => b.timestamp - a.timestamp);
  
  return feed.slice(0, 15);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Get Stats ──────────────────────────────────────────────────────────
export function getStats(tasks: Task[]) {
  return {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    assigned: tasks.filter(t => t.status === 'assigned').length,
    inbox: tasks.filter(t => t.status === 'inbox').length,
    waiting: tasks.filter(t => t.status === 'waiting').length,
  };
}
