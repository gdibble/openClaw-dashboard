'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Zap,
  Users,
  ListTodo,
  Settings,
  Moon,
  Sun,
  Bell,
  RefreshCw,
  Plus,
  Filter,
  Keyboard,
  MessageSquare,
  Activity,
  FileText,
} from 'lucide-react'

interface CommandPaletteProps {
  onAction?: (action: string, payload?: unknown) => void
}

interface CommandItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
}

interface CommandGroup {
  heading: string
  commands: CommandItem[]
}

const GROUPS: CommandGroup[] = [
  {
    heading: 'Quick Actions',
    commands: [
      { id: 'new-task', label: 'Create New Task', icon: Plus, shortcut: 'N' },
      { id: 'refresh', label: 'Refresh Data', icon: RefreshCw, shortcut: 'R' },
      { id: 'toggle-feed', label: 'Toggle Live Feed', icon: Activity, shortcut: 'F' },
    ],
  },
  {
    heading: 'Navigation',
    commands: [
      { id: 'view-agents', label: 'View All Agents', icon: Users, shortcut: 'A' },
      { id: 'view-tasks', label: 'View All Tasks', icon: ListTodo, shortcut: 'T' },
      { id: 'view-messages', label: 'View Messages', icon: MessageSquare, shortcut: 'M' },
    ],
  },
  {
    heading: 'Filters',
    commands: [
      { id: 'filter-spark', label: 'Filter: Spark Tasks', icon: Filter },
      { id: 'filter-scout', label: 'Filter: Scout Tasks', icon: Filter },
      { id: 'filter-urgent', label: 'Filter: Urgent Only', icon: Zap },
      { id: 'filter-in-progress', label: 'Filter: In Progress', icon: Filter },
    ],
  },
  {
    heading: 'Settings',
    commands: [
      { id: 'toggle-theme', label: 'Toggle Theme', icon: Moon, shortcut: 'D' },
      { id: 'toggle-sounds', label: 'Toggle Sounds', icon: Bell, shortcut: 'S' },
      { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, shortcut: '?' },
      { id: 'settings', label: 'Open Settings', icon: Settings, shortcut: ',' },
    ],
  },
  {
    heading: 'Reports',
    commands: [
      { id: 'export-report', label: 'Export Weekly Report', icon: FileText },
      { id: 'view-metrics', label: 'View Detailed Metrics', icon: Activity },
    ],
  },
]

export function CommandPalette({ onAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Toggle with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = useCallback(
    (commandId: string) => {
      setOpen(false)
      setSearch('')
      onAction?.(commandId)
    },
    [onAction]
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <Command
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(33,34,37,0.95), rgba(24,25,27,0.98))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.05), 0 4px 8px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.6)',
              }}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
                <Search className="w-5 h-5 text-[#697177]" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-white placeholder:text-[#697177] outline-none text-base"
                  autoFocus
                />
                <kbd className="px-2 py-1 text-xs text-[#697177] bg-white/[0.05] rounded border border-white/[0.08]">
                  ESC
                </kbd>
              </div>

              {/* Command List */}
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-[#697177] text-sm">
                  No results found.
                </Command.Empty>

                {GROUPS.map((group) => (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className="mb-2"
                  >
                    <div className="px-2 py-2 text-xs font-medium text-[#697177] uppercase tracking-wider">
                      {group.heading}
                    </div>
                    {group.commands.map((command) => (
                      <Command.Item
                        key={command.id}
                        value={command.label}
                        onSelect={() => handleSelect(command.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[#b0b4ba] hover:bg-white/[0.06] hover:text-white data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white transition-colors group"
                      >
                        <command.icon className="w-4 h-4 text-[#697177] group-hover:text-[#b0b4ba] group-data-[selected=true]:text-[#b0b4ba]" />
                        <span className="flex-1">{command.label}</span>
                        {command.shortcut && (
                          <kbd className="px-1.5 py-0.5 text-xs text-[#697177] bg-white/[0.05] rounded border border-white/[0.08] font-mono">
                            {command.shortcut}
                          </kbd>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#697177]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded border border-white/[0.08]">
                      ↑↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded border border-white/[0.08]">
                      ↵
                    </kbd>
                    Select
                  </span>
                </div>
                <span className="text-[#8e4ec6]">OpenClaw</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
