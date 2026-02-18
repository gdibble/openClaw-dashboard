'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Routine } from '@/types';

interface UseRoutinesReturn {
  routines: Routine[];
  loading: boolean;
  create: (input: Partial<Routine>) => Promise<void>;
  update: (id: string, input: Partial<Routine>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  trigger: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRoutines(): UseRoutinesReturn {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutines = useCallback(async () => {
    try {
      const res = await fetch('/api/routines');
      if (!res.ok) return;
      const data = await res.json();
      setRoutines(data.routines || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  const create = useCallback(async (input: Partial<Routine>) => {
    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) await fetchRoutines();
  }, [fetchRoutines]);

  const update = useCallback(async (id: string, input: Partial<Routine>) => {
    const res = await fetch(`/api/routines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) await fetchRoutines();
  }, [fetchRoutines]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchRoutines();
  }, [fetchRoutines]);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    await update(id, { enabled } as Partial<Routine>);
  }, [update]);

  const trigger = useCallback(async (id: string) => {
    await fetch(`/api/routines/${id}`, {
      method: 'POST',
    });
    await fetchRoutines();
  }, [fetchRoutines]);

  return { routines, loading, create, update, remove, toggle, trigger, refresh: fetchRoutines };
}
