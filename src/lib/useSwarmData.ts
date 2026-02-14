'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Agent, Task, FeedItem, TokenStats } from '@/types';

interface DashboardConfig {
  name: string;
  subtitle: string;
  repoUrl: string | null;
  version: string;
}

export interface ClientSettings {
  name: string;
  subtitle: string;
  repoUrl: string | null;
  logoIcon: string;
  theme: 'dark' | 'light';
  accentColor: string;
  accent: { primary: string; primaryLight: string; glow: string };
  backgroundGradient: { topLeft: string; bottomRight: string };
  cardDensity: 'compact' | 'comfortable';
  showMetricsPanel: boolean;
  showTokenPanel: boolean;
  refreshInterval: number;
  timeDisplay: 'utc' | 'local';
}

interface SwarmData {
  agents: Agent[];
  tasks: Task[];
  feed: FeedItem[];
  stats: {
    total: number;
    done: number;
    inProgress: number;
    review: number;
    assigned: number;
    inbox: number;
    waiting: number;
  };
  tokenStats: TokenStats | null;
  config: DashboardConfig | null;
  settings: ClientSettings | null;
  timestamp: number;
}

interface UseSwarmDataReturn {
  agents: Agent[];
  tasks: Task[];
  feed: FeedItem[];
  stats: SwarmData['stats'] | null;
  tokenStats: TokenStats | null;
  config: DashboardConfig | null;
  settings: ClientSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

export function useSwarmData(): UseSwarmDataReturn {
  const [data, setData] = useState<SwarmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      const apiKey = process.env.NEXT_PUBLIC_OPENCLAW_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch('/api/data', { cache: 'no-store', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch swarm data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh — uses settings.refreshInterval when available, else 30s
  const refreshMs = data?.settings?.refreshInterval ?? 30000;
  useEffect(() => {
    const interval = setInterval(fetchData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshMs]);

  // Optimistic task update
  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t => 
          t.id === taskId ? { ...t, ...updates, updatedAt: Date.now() } : t
        ),
      };
    });
  }, []);

  return {
    agents: data?.agents || [],
    tasks: data?.tasks || [],
    feed: data?.feed || [],
    stats: data?.stats || null,
    tokenStats: data?.tokenStats || null,
    config: data?.config || null,
    settings: data?.settings || null,
    loading,
    error,
    refresh: fetchData,
    lastUpdated: data?.timestamp || null,
    updateTask,
  };
}
