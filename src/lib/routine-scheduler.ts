import { isDbAvailable, query } from '@/lib/db';
import { createTask } from '@/lib/db-data';
import type { RoutineSchedule, CreateTaskInput } from '@/types';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (schedulerInterval) return;
  if (!isDbAvailable()) return;

  console.log('Routine scheduler started (60s interval)');
  schedulerInterval = setInterval(tick, 60_000);

  // First tick after 5s
  setTimeout(tick, 5000);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function tick(): Promise<void> {
  if (!isDbAvailable()) return;

  try {
    const result = await query<{
      id: string; name: string; agent_id: string | null;
      schedule: RoutineSchedule; task_template: CreateTaskInput;
    }>(
      `SELECT id, name, agent_id, schedule, task_template
       FROM routines
       WHERE enabled = TRUE AND next_run_at <= NOW()`,
    );

    for (const routine of result.rows) {
      try {
        // Create task from template
        const template = routine.task_template;
        await createTask({
          title: template.title || `[Routine] ${routine.name}`,
          description: template.description,
          status: template.status ?? 'inbox',
          priority: template.priority ?? 2,
          assigneeId: template.assigneeId ?? routine.agent_id ?? undefined,
          tags: [...(template.tags ?? []), 'routine'],
        });

        // Update last_run_at and calculate next_run_at
        const nextRun = calculateNextRun(routine.schedule);
        await query(
          `UPDATE routines SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW() WHERE id = $2`,
          [nextRun, routine.id],
        );

        console.log(`Routine "${routine.name}" fired, next run: ${nextRun?.toISOString() ?? 'never'}`);
      } catch (err) {
        console.error(`Routine "${routine.name}" failed:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('Scheduler tick failed:', err instanceof Error ? err.message : err);
  }
}

export function calculateNextRun(schedule: RoutineSchedule): Date | null {
  if (!schedule.days || schedule.days.length === 0) return null;
  if (!schedule.time) return null;

  const [hours, minutes] = schedule.time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const now = new Date();

  // Try each of the next 8 days to find a matching day
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(hours, minutes, 0, 0);

    // Check if this day-of-week is in the schedule
    const dayOfWeek = candidate.getDay();
    if (!schedule.days.includes(dayOfWeek)) continue;

    // Skip if this time has already passed today
    if (dayOffset === 0 && candidate <= now) continue;

    return candidate;
  }

  return null;
}
