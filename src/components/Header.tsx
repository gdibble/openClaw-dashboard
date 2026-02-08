'use client';

import { Activity, Menu, Zap, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  activeAgents: number;
  totalAgents: number;
  totalTasks: number;
  inProgressTasks: number;
  feedOpen: boolean;
  onFeedToggle: () => void;
  onCommandPalette?: () => void;
}

export default function Header({
  activeAgents,
  totalAgents,
  totalTasks,
  inProgressTasks,
  feedOpen,
  onFeedToggle,
  onCommandPalette,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 mb-2">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-green-DEFAULT/20 blur-xl rounded-full" />
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-DEFAULT/20 to-green-DEFAULT/5 border border-green-DEFAULT/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-DEFAULT" />
          </div>
        </div>
        
        {/* Title */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            OpenClaw
          </h1>
          <p className="text-xs text-muted-foreground">Mission Control</p>
        </div>
      </div>

      {/* Center: Stats */}
      <div className="hidden md:flex items-center gap-6">
        {/* Active Agents */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="status-dot working" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-tabular">{activeAgents}</span>
              <span className="text-muted-foreground">/{totalAgents}</span>
            </span>
          </div>
          <span className="text-xs text-muted-foreground">agents</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Tasks */}
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-semibold text-foreground font-tabular">{inProgressTasks}</span>
            <span className="text-muted-foreground"> active</span>
          </span>
          <span className="text-xs text-muted-foreground">
            of {totalTasks} tasks
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Command Palette Button */}
        {onCommandPalette && (
          <button
            onClick={onCommandPalette}
            className={cn(
              "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
              "bg-secondary/50 text-muted-foreground",
              "border border-border hover:border-border/80",
              "hover:bg-secondary hover:text-foreground",
              "transition-all duration-200"
            )}
          >
            <Command className="w-3.5 h-3.5" />
            <span className="text-xs">Search</span>
            <kbd className="kbd ml-1">⌘K</kbd>
          </button>
        )}

        {/* Activity Feed Toggle */}
        <button
          onClick={onFeedToggle}
          className={cn(
            "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
            feedOpen
              ? "bg-green-DEFAULT/10 text-green-DEFAULT border border-green-DEFAULT/30"
              : "bg-secondary/50 text-muted-foreground border border-border hover:border-border/80 hover:text-foreground hover:bg-secondary"
          )}
        >
          <Activity className="w-4 h-4" />
          
          {/* Notification dot */}
          {!feedOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-DEFAULT animate-pulse-soft" 
              style={{ boxShadow: '0 0 8px rgba(70, 167, 88, 0.6)' }}
            />
          )}
        </button>
      </div>
    </header>
  );
}
