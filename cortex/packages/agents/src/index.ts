import type { CortexDb } from "@cortex/db";
import * as priya from "./priya/index.js";

export { priya };

export type AgentRunner = (db: CortexDb, storeId: string) => Promise<{ runId: string }>;

/** Registry of manually/scheduler-triggerable agent routines, keyed by
 * agent id (AGENTS.md §5.11 `POST /api/cortex/agents/:id/run`). Importing
 * this module also runs each agent's module-level decision-executor
 * registration as a side effect. */
export const AGENT_RUNNERS: Record<string, AgentRunner> = {
  [priya.AGENT_ID]: priya.run,
};
