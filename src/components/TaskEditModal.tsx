'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Square, CheckSquare, Plus, MessageSquare, Send } from 'lucide-react';
import type { Agent, TaskDetail, TaskStatus, Priority, ChecklistItem, TaskComment } from '@/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';

interface TaskEditModalProps {
  taskId: string;
  agents: Agent[];
  onClose: () => void;
  onUpdated: () => void;
}

type Tab = 'details' | 'checklist' | 'comments';

export default function TaskEditModal({ taskId, agents, onClose, onUpdated }: TaskEditModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [error, setError] = useState('');

  // Detail fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const [priority, setPriority] = useState<Priority>(2);
  const [assigneeId, setAssigneeId] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Checklist
  const [newChecklistLabel, setNewChecklistLabel] = useState('');

  // Comments
  const [newComment, setNewComment] = useState('');

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to load task');
      const data = await res.json() as TaskDetail;
      setTask(data);
      setTitle(data.title);
      setDescription(data.description);
      setStatus(data.status);
      setPriority(data.priority);
      setAssigneeId(data.assigneeId ?? '');
      setTagsInput(data.tags.join(', '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          assigneeId: assigneeId || null,
          tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      onUpdated();
      await fetchTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklist(item: ChecklistItem) {
    try {
      await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, checked: !item.checked }),
      });
      await fetchTask();
    } catch { /* silently retry on next load */ }
  }

  async function addChecklist() {
    if (!newChecklistLabel.trim()) return;
    try {
      await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newChecklistLabel.trim() }),
      });
      setNewChecklistLabel('');
      await fetchTask();
    } catch { /* ignore */ }
  }

  async function deleteChecklist(id: number) {
    try {
      await fetch(`/api/tasks/${taskId}/checklist?itemId=${id}`, { method: 'DELETE' });
      await fetchTask();
    } catch { /* ignore */ }
  }

  async function addCommentHandler() {
    if (!newComment.trim()) return;
    try {
      await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      setNewComment('');
      await fetchTask();
    } catch { /* ignore */ }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'checklist', label: `Checklist${task?.checklist?.length ? ` (${task.checklist.length})` : ''}` },
    { key: 'comments', label: `Comments${task?.comments?.length ? ` (${task.comments.length})` : ''}` },
  ];

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground truncate pr-4">
            {loading ? 'Loading...' : task?.title || 'Edit Task'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-muted/50 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Details Tab */}
            {activeTab === 'details' && (
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Title</label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Description</label>
                  <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                                 focus:outline-none focus:border-[var(--accent-primary)]">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                                 focus:outline-none focus:border-[var(--accent-primary)]">
                      {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Assignee</label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               focus:outline-none focus:border-[var(--accent-primary)]">
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">Tags</label>
                  <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Comma-separated"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <button type="submit" disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)]
                             hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-opacity">
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div className="space-y-3">
                {task?.checklist?.map(item => (
                  <div key={item.id} className="flex items-center gap-3 group">
                    <button onClick={() => toggleChecklist(item)} className="text-muted-foreground hover:text-foreground">
                      {item.checked
                        ? <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                    <span className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {item.label}
                    </span>
                    <button onClick={() => deleteChecklist(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input type="text" value={newChecklistLabel} onChange={(e) => setNewChecklistLabel(e.target.value)}
                    placeholder="Add checklist item..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklist())}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button onClick={addChecklist} disabled={!newChecklistLabel.trim()}
                    className="px-3 py-2 bg-[var(--accent-primary)] disabled:opacity-50 text-white rounded-lg transition-opacity">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-3">
                {task?.comments?.map(comment => (
                  <div key={comment.id} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">{comment.author}</span>
                      <span className="text-xs text-muted-foreground/50">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{comment.content}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCommentHandler())}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                               placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button onClick={addCommentHandler} disabled={!newComment.trim()}
                    className="px-3 py-2 bg-[var(--accent-primary)] disabled:opacity-50 text-white rounded-lg transition-opacity">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
