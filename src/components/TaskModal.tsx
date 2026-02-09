'use client';

import { motion } from 'framer-motion';
import { X, Clock, Tag, User } from 'lucide-react';
import { cn, timeAgo, formatTokens } from '@/lib/utils';
import type { Agent, Task } from '@/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
import AgentAvatar from './AgentAvatar';

interface TaskModalProps {
  task: Task;
  agents: Agent[];
  onClose: () => void;
}

export default function TaskModal({ task, agents, onClose }: TaskModalProps) {
  const priority = PRIORITY_CONFIG[task.priority];
  const status = STATUS_CONFIG[task.status];
  const assignee = task.assigneeId 
    ? agents.find(a => a.id === task.assigneeId) 
    : null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        layoutId={`task-${task.id}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{
                color: priority.color,
                backgroundColor: priority.bgColor,
                border: `1px solid ${priority.color}30`,
              }}
            >
              {priority.label}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {task.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground mb-3">
          {task.title}
        </h2>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {task.description}
        </p>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {task.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-background/50 border border-border/50 mb-6">
          {/* Status */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
              Status
            </span>
            <div className="flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="text-sm font-medium text-foreground">
                {status.label}
              </span>
            </div>
          </div>

          {/* Created */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
              Created
            </span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-tabular" suppressHydrationWarning>
                {timeAgo(task.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Token Usage */}
        {task.usage && task.usage.length > 0 && (() => {
          const totalIn = task.usage.reduce((s, u) => s + u.inputTokens, 0);
          const totalOut = task.usage.reduce((s, u) => s + u.outputTokens, 0);
          const models = [...new Set(task.usage.map(u => u.model).filter(Boolean))];
          return (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#3e63dd]/5 border border-[#3e63dd]/10 mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                  Input Tokens
                </span>
                <span className="text-sm font-medium text-foreground font-tabular">
                  {formatTokens(totalIn)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                  Output Tokens
                </span>
                <span className="text-sm font-medium text-foreground font-tabular">
                  {formatTokens(totalOut)}
                </span>
              </div>
              {models.length > 0 && (
                <div className="col-span-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">
                    Model{models.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {models.join(', ')}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Assignee */}
        <div className="pt-4 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-3">
            Assigned to
          </span>
          {assignee ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
              <AgentAvatar agent={assignee} size="lg" showStatus={true} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {assignee.name}
                  </span>
                  {assignee.badge && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      assignee.badge === 'lead' 
                        ? "text-green-DEFAULT bg-green-DEFAULT/10" 
                        : "text-blue-DEFAULT bg-blue-DEFAULT/10"
                    )}>
                      {assignee.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {assignee.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-dashed border-border/50">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <span className="text-sm text-muted-foreground/60 italic">
                No one assigned yet
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Close
          </button>
          <span className="kbd">ESC</span>
        </div>
      </motion.div>
    </>
  );
}
