export interface Agent {
  id: string;
  name: string;
  letter: string;
  color: string;
  role: string;
  status: 'working' | 'idle';
  badge?: 'lead' | 'spc';
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string;
  tags: string[];
  createdAt: number;
  updatedAt?: number;
}

export type TaskStatus = 'inbox' | 'assigned' | 'in-progress' | 'review' | 'waiting' | 'done';
export type Priority = 0 | 1 | 2; // 0 = urgent, 1 = high, 2 = normal

export interface FeedItem {
  id: string;
  type: 'status' | 'task' | 'comment' | 'decision';
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  agentId?: string;
  timestamp: number;
}

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export interface PriorityConfig {
  label: string;
  color: string;
  bgColor: string;
}

export const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  'inbox': { label: 'Inbox', color: '#697177', bgColor: 'rgba(105, 113, 119, 0.1)' },
  'assigned': { label: 'Assigned', color: '#ffb224', bgColor: 'rgba(255, 178, 36, 0.1)' },
  'in-progress': { label: 'In Progress', color: '#3e63dd', bgColor: 'rgba(62, 99, 221, 0.1)' },
  'review': { label: 'Review', color: '#8e4ec6', bgColor: 'rgba(142, 78, 198, 0.1)' },
  'waiting': { label: 'Waiting', color: '#ffb224', bgColor: 'rgba(255, 178, 36, 0.1)' },
  'done': { label: 'Done', color: '#46a758', bgColor: 'rgba(70, 167, 88, 0.1)' },
};

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  0: { label: 'Urgent', color: '#e54d2e', bgColor: 'rgba(229, 77, 46, 0.1)' },
  1: { label: 'High', color: '#ffb224', bgColor: 'rgba(255, 178, 36, 0.1)' },
  2: { label: 'Normal', color: '#697177', bgColor: 'rgba(105, 113, 119, 0.1)' },
};

export const LANE_ORDER: TaskStatus[] = ['in-progress', 'review', 'assigned', 'waiting', 'inbox', 'done'];
