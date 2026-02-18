import { NextResponse } from 'next/server';
import { isDbAvailable, query } from '@/lib/db';
import { calculateNextRun } from '@/lib/routine-scheduler';
import type { Routine, RoutineSchedule, CreateTaskInput } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbAvailable()) {
    return NextResponse.json({ routines: [] });
  }

  try {
    const result = await query<{
      id: string; name: string; description: string; agent_id: string | null;
      schedule: RoutineSchedule; enabled: boolean; last_run_at: Date | null;
      next_run_at: Date | null; task_template: CreateTaskInput;
      created_at: Date; updated_at: Date;
    }>(`SELECT * FROM routines ORDER BY name`);

    const routines: Routine[] = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      agentId: r.agent_id ?? undefined,
      schedule: r.schedule,
      enabled: r.enabled,
      lastRunAt: r.last_run_at?.getTime(),
      nextRunAt: r.next_run_at?.getTime(),
      taskTemplate: r.task_template,
      createdAt: r.created_at.getTime(),
      updatedAt: r.updated_at.getTime(),
    }));

    return NextResponse.json({ routines });
  } catch (error) {
    console.error('Error loading routines:', error);
    return NextResponse.json({ error: 'Failed to load routines' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: {
    name: string; description?: string; agentId?: string;
    schedule: RoutineSchedule; taskTemplate: CreateTaskInput;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim() || !body.schedule || !body.taskTemplate) {
    return NextResponse.json({ error: 'name, schedule, and taskTemplate are required' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const nextRun = calculateNextRun(body.schedule);

  try {
    await query(
      `INSERT INTO routines (id, name, description, agent_id, schedule, task_template, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id, body.name.trim(), body.description?.trim() ?? '',
        body.agentId ?? null,
        JSON.stringify(body.schedule), JSON.stringify(body.taskTemplate),
        nextRun,
      ],
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Error creating routine:', error);
    return NextResponse.json({ error: 'Failed to create routine' }, { status: 500 });
  }
}
