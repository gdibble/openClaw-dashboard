import { isDbAvailable, query } from '@/lib/db';

export interface ActivityEvent {
  eventType: string;
  entityType: string;
  entityId?: string;
  agentId?: string;
  payload?: Record<string, unknown>;
}

export async function logActivity(event: ActivityEvent): Promise<void> {
  if (!isDbAvailable()) return;

  try {
    await query(
      `INSERT INTO activity_log (event_type, entity_type, entity_id, agent_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.eventType, event.entityType, event.entityId ?? null,
       event.agentId ?? null, JSON.stringify(event.payload ?? {})],
    );
  } catch (err) {
    console.error('Failed to log activity:', err instanceof Error ? err.message : err);
  }

  // Broadcast to WS clients
  try {
    const { broadcast } = await import('@/lib/ws-server');
    broadcast('feed:new', {
      id: `${Date.now()}-${event.eventType}`,
      type: event.entityType === 'task' ? 'task' : 'status',
      severity: event.eventType.includes('completed') ? 'success' : 'info',
      title: (event.payload?.title as string) || event.eventType,
      agentId: event.agentId,
      timestamp: Date.now(),
    });
  } catch { /* WS not available */ }
}
