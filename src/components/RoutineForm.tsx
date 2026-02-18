'use client';

import { useState, FormEvent } from 'react';
import type { Agent, Routine, RoutineSchedule, CreateTaskInput } from '@/types';

interface RoutineFormProps {
  agents: Agent[];
  onSubmit: (input: Partial<Routine>) => Promise<void>;
  onCancel: () => void;
}

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export default function RoutineForm({ agents, onSubmit, onCancel }: RoutineFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [time, setTime] = useState('09:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !taskTitle.trim()) return;

    setLoading(true);
    const schedule: RoutineSchedule = {
      days: selectedDays,
      time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const taskTemplate: CreateTaskInput = {
      title: taskTitle.trim(),
      assigneeId: agentId || undefined,
    };

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      agentId: agentId || undefined,
      schedule,
      taskTemplate,
    });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Routine Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Daily standup check" required
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                     placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--accent-primary)]" />
      </div>

      <div>
        <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Task Title</label>
        <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
          placeholder="Title for the created task" required
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                     placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--accent-primary)]" />
      </div>

      <div>
        <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Schedule Days</label>
        <div className="flex gap-1">
          {DAYS.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                selectedDays.includes(d.value)
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                  : 'bg-background text-muted-foreground border-border hover:border-border/80'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                       focus:outline-none focus:border-[var(--accent-primary)]" />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Assignee</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground
                       focus:outline-none focus:border-[var(--accent-primary)]">
            <option value="">Unassigned</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={loading || !name.trim() || !taskTitle.trim()}
          className="flex-1 px-4 py-2 bg-[var(--accent-primary)] disabled:opacity-50 text-white text-sm
                     font-medium rounded-lg transition-opacity">
          {loading ? 'Creating...' : 'Create Routine'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
