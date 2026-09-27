import { eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import { makeId } from "./ids.js";
import { now } from "./clock.js";

/** One row per routine run; children reference `parentTaskId` for sub-steps
 * (dip detected -> root-cause check -> cohort build -> decision staged). */
export async function startRun(
  db: CortexDb,
  args: { storeId: string; agentId: string; label: string },
): Promise<{ runId: string; taskId: string }> {
  const runId = makeId("run");
  const taskId = makeId("task");
  await db.insert(schema.tasks).values({
    id: taskId,
    storeId: args.storeId,
    agentId: args.agentId,
    runId,
    parentTaskId: null,
    label: args.label,
    status: "RUNNING",
    createdAt: now(),
  });
  return { runId, taskId };
}

export async function addSubTask(
  db: CortexDb,
  args: { storeId: string; agentId: string; runId: string; parentTaskId: string; label: string },
): Promise<string> {
  const taskId = makeId("task");
  await db.insert(schema.tasks).values({
    id: taskId,
    storeId: args.storeId,
    agentId: args.agentId,
    runId: args.runId,
    parentTaskId: args.parentTaskId,
    label: args.label,
    status: "RUNNING",
    createdAt: now(),
  });
  return taskId;
}

export async function completeTask(
  db: CortexDb,
  taskId: string,
  status: "DONE" | "FAILED" = "DONE",
): Promise<void> {
  await db.update(schema.tasks).set({ status }).where(eq(schema.tasks.id, taskId));
}
