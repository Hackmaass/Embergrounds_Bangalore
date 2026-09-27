import { Router } from "express";
import type { CortexDb } from "@cortex/db";
import { DEMO_STORE_ID } from "@cortex/db";
import { decideDecision, dispatchInboundText } from "@cortex/runtime";
import { parseWhatsAppWebhook } from "@cortex/channels";
import { SimulatorInboundSchema } from "@cortex/shared";

export function channelsRouter(db: CortexDb): Router {
  const router = Router();
  const storeId = DEMO_STORE_ID;

  // Meta webhook verification handshake (AGENTS.md §5.12). Live inbound
  // message handling is wired in the P3 gateways milestone.
  router.get("/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === (process.env.WHATSAPP_VERIFY_TOKEN ?? "cortex-verify")) {
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  });

  router.post("/whatsapp/webhook", async (req, res) => {
    // Not verifiable in this environment — no Meta app/token exists here.
    // Structurally wired to the same channel-agnostic pipeline the
    // simulator and Telegram use, gated on WHATSAPP_ACCESS_TOKEN being set.
    res.sendStatus(200); // ack immediately; Meta retries on non-2xx
    if (!process.env.WHATSAPP_ACCESS_TOKEN) return;

    const event = parseWhatsAppWebhook(req.body, storeId);
    if (!event) return;

    try {
      if (event.kind === "BUTTON" && event.button) {
        await decideDecision(db, { decisionId: event.button.decisionId, storeId, action: event.button.action, source: "WHATSAPP" });
      } else if (event.kind === "TEXT" && event.text) {
        await dispatchInboundText({ db, storeId, role: event.role, identityId: event.identityId, text: event.text });
      }
    } catch (err) {
      console.error("[whatsapp] webhook handling failed:", err);
    }
  });

  router.post("/simulator/inbound", async (req, res) => {
    const parsed = SimulatorInboundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_BODY", details: parsed.error.flatten() });
    }
    const input = parsed.data;

    if (input.button) {
      let outcome;
      try {
        outcome = await decideDecision(db, {
          decisionId: input.button.decision_id,
          storeId,
          action: input.button.action,
          source: input.channel,
        });
      } catch (err) {
        console.error("[simulator] decision action failed:", err);
        return res.status(500).json({ accepted: false, error: "DECISION_INTEGRITY_ERROR" });
      }
      if (!outcome.ok) {
        return res.status(outcome.httpStatus).json({ accepted: false, error: outcome.error });
      }
      return res.json({ accepted: true, routed_to: input.button.decision_id });
    }

    if (input.text) {
      const outcome = await dispatchInboundText({
        db,
        storeId,
        role: input.role,
        identityId: input.identity_id,
        text: input.text,
      });
      return res.json({ accepted: true, ...(outcome.routedTo ? { routed_to: outcome.routedTo } : {}) });
    }

    res.json({ accepted: true });
  });

  return router;
}
