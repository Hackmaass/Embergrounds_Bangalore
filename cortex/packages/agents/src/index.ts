import type { CortexDb } from "@cortex/db";
import * as priya from "./priya/index.js";
import * as aman from "./aman/index.js";
import * as munim from "./munim/index.js";
import * as vikram from "./vikram/index.js";
import * as meera from "./meera/index.js";
import * as studio from "./studio/index.js";

import { registerInboundTextHandler } from "@cortex/runtime";
import { handleInboundMessage } from "./orchestrator.js";

export { priya, aman, munim, vikram, meera, studio };
export * from "./orchestrator.js";

// Register master inbound message orchestrator
registerInboundTextHandler(handleInboundMessage);

export type AgentRunner = (db: CortexDb, storeId: string) => Promise<{ runId: string }>;

/** Registry of manually/scheduler-triggerable agent routines, keyed by
 * agent id (AGENTS.md §5.11 `POST /api/cortex/agents/:id/run`). Importing
 * this module also runs each agent's module-level decision-executor
 * registration as a side effect. */
export const AGENT_RUNNERS: Record<string, AgentRunner> = {
  [priya.AGENT_ID]: priya.run,
  [aman.AGENT_ID]: aman.run,
  [munim.AGENT_ID]: munim.run,
  [vikram.AGENT_ID]: vikram.run,
  [meera.AGENT_ID]: meera.run,
};
