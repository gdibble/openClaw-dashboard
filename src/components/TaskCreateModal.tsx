'use client';

import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import type { Agent, TaskStatus, Priority, CreateTaskInput } from '@/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';

interface TaskCreateModalProps {
  agents: Agent[];
  onClose: () => void;
  onCreated: (task: CreateTaskInput) => void;
}

export default function TaskCreateModal({ agents, onClose, onCreated }: TaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const [priority, setPriority] = useState<Priority>(2);
  const [assigneeId, setAssigneeId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');

    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      assigneeId: assigneeId || undefined,
      tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      onCreated(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl
                   p-6 max-h-[85vh] overflow-y-auto"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">New Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              required
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm
                         text-foreground placeholder:text-muted-foreground/50 resize-none
                         focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                           focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                           focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                         focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Comma-separated tags"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)]
                       hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-lg
                       transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
