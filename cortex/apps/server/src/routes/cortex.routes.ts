import { Router } from "express";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID } from "@cortex/db";
import { activityBus, decideDecision, getActivitySnapshot } from "@cortex/runtime";
import { getWorkforce } from "@cortex/runtime";
import { AGENT_RUNNERS, studio } from "@cortex/agents";
import { DecisionActionRequestSchema, type ActivityEvent } from "@cortex/shared";
import { computeMetrics } from "../services/metrics.js";

export function cortexRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID; // single-store demo (AGENTS.md §5 base URL note)

  router.get("/workforce", async (_req, res) => {
    res.json(await getWorkforce(db, storeId));
  });

  router.get("/stream", async (_req, res) => {
    res.json(await getActivitySnapshot(db, storeId));
  });

  router.get("/stream/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const onActivity = (event: ActivityEvent) => {
      res.write(`event: activity\ndata: ${JSON.stringify(event)}\n\n`);
    };
    activityBus.on("activity", onActivity);

    req.on("close", () => {
      activityBus.off("activity", onActivity);
    });
  });

  router.get("/metrics", async (_req, res) => {
    res.json(await computeMetrics(db, storeId));
  });

  router.post("/decisions/:id/action", async (req, res) => {
    const parsed = DecisionActionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });
    }

    let outcome;
    try {
      outcome = await decideDecision(db, {
        decisionId: req.params.id as string,
        storeId,
        action: parsed.data.action,
        source: parsed.data.source,
      });
    } catch (err) {
      console.error(`[decisions] ${req.params.id} action failed:`, err);
      return res.status(500).json({ success: false, decision_id: req.params.id, error: "DECISION_INTEGRITY_ERROR" });
    }

    if (!outcome.ok) {
      return res.status(outcome.httpStatus).json({
        success: false,
        decision_id: req.params.id,
        error: outcome.error,
        status: "status" in outcome ? outcome.status : undefined,
      });
    }
    res.json(outcome.response);
  });

  router.post("/agents/:id/run", async (req, res) => {
    const agentId = req.params.id as string;
    const runner = AGENT_RUNNERS[agentId];
    try {
      const { runId } = runner ? await runner(db, storeId) : await studio.runCustomAgent(db, storeId, agentId);
      res.json({ run_id: runId, agent_id: agentId, status: "STARTED" });
    } catch (err) {
      if (err instanceof Error && err.message === "AGENT_NOT_FOUND") {
        return res.status(404).json({ error: "AGENT_NOT_FOUND" });
      }
      throw err;
    }
  });

  return router;
}
