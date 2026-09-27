import { hhmm, dayOfMonth } from "./clock.js";

export type RoutineSchedule =
  | { type: "DAILY"; time: string } // "HH:MM" IST
  | { type: "MONTHLY"; day: number; time: string };

/** Pure predicate — does `schedule` fire at instant `at`? Minute-resolution. */
export function matchesNow(schedule: RoutineSchedule, at: Date): boolean {
  const time = hhmm(at);
  if (schedule.type === "DAILY") return time === schedule.time;
  return dayOfMonth(at) === schedule.day && time === schedule.time;
}

export interface RegisteredRoutine {
  id: string;
  label: string;
  schedule: RoutineSchedule;
  handler: () => Promise<void>;
}

/**
 * Minimal in-process cron: polls every `tickMs`, fires a routine at most
 * once per matching minute (skip-missed — no backfill of missed windows),
 * and never overlaps a routine with itself (coalesce-if-active).
 */
export class Scheduler {
  private routines: RegisteredRoutine[] = [];
  private lastFiredMinuteKey = new Map<string, string>();
  private active = new Set<string>();
  private timer: NodeJS.Timeout | undefined;

  register(routine: RegisteredRoutine): void {
    this.routines.push(routine);
  }

  start(tickMs = 30_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(new Date()), tickMs);
    this.timer.unref?.();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(at: Date): Promise<void> {
    const minuteKey = at.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    for (const routine of this.routines) {
      if (!matchesNow(routine.schedule, at)) continue;
      if (this.lastFiredMinuteKey.get(routine.id) === minuteKey) continue; // already fired this minute
      if (this.active.has(routine.id)) continue; // coalesce-if-active

      this.lastFiredMinuteKey.set(routine.id, minuteKey);
      this.active.add(routine.id);
      routine
        .handler()
        .catch((err) => console.error(`[scheduler] routine ${routine.id} failed:`, err))
        .finally(() => this.active.delete(routine.id));
    }
  }
}
