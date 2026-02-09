'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Agent, Task, FeedItem, TokenStats } from '@/types';

interface DashboardConfig {
  name: string;
  subtitle: string;
  repoUrl: string | null;
  version: string;
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
  timestamp: number;
}

interface UseSwarmDataReturn {
  agents: Agent[];
  tasks: Task[];
  feed: FeedItem[];
  stats: SwarmData['stats'] | null;
  tokenStats: TokenStats | null;
  config: DashboardConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

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

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

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
    loading,
    error,
    refresh: fetchData,
    lastUpdated: data?.timestamp || null,
    updateTask,
  };
}
