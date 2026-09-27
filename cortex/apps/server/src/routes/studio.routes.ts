import { Router } from "express";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID } from "@cortex/db";
import { studio } from "@cortex/agents";
import { CustomAgentGenerateRequestSchema } from "@cortex/shared";

export function studioRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  router.get("/custom-agents/templates", (_req, res) => {
    res.json(studio.STUDIO_TEMPLATES.map(({ template_id, name, avatar, description, prompt }) => ({ template_id, name, avatar, description, prompt })));
  });

  router.post("/custom-agents/generate", async (req, res) => {
    const parsed = CustomAgentGenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });

    const outcome = studio.compileSpec(parsed.data);
    if (outcome.rejected) {
      return res.status(422).json({ error: "UNSAFE_SPEC_REQUEST", reason: outcome.reason });
    }

    await studio.persistDraft(db, storeId, outcome.spec);
    res.status(201).json(outcome.spec);
  });

  router.post("/custom-agents/:id/hire", async (req, res) => {
    try {
      const spec = await studio.hireAgent(db, storeId, req.params.id as string);
      res.json(spec);
    } catch (err) {
      if (err instanceof Error && err.message === "AGENT_NOT_FOUND") {
        return res.status(404).json({ error: "AGENT_NOT_FOUND" });
      }
      throw err;
    }
  });

  return router;
}
