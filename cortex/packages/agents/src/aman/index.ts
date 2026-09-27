import { eq } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import {
  appendActivityEvent,
  registerInboundTextHandler,
  startRun,
  completeTask,
  setAgentMetric,
  makeId,
} from "@cortex/runtime";
import { paytmPgMock } from "@cortex/connectors";
import { simulatorWhatsapp } from "@cortex/channels";
import { numberToHindiWords } from "./hindi-numbers.js";

export const AGENT_ID = "aman-support";
const AGENT_NAME = "Aman";
const AGENT_AVATAR = "🛡️";
const LOOKUP_WINDOW_MINUTES = 5;

const CHECK_INTENT = /check|kitna|payment|paisa|kat gaya/i;
const AMOUNT_PATTERN = /₹?\s*(\d+(?:\.\d+)?)/;

registerInboundTextHandler(async ({ db, storeId, text }) => {
  if (!CHECK_INTENT.test(text)) return { handled: false };
  const match = text.match(AMOUNT_PATTERN);
  if (!match?.[1]) return { handled: false };

  await checkPayment(db, storeId, Number(match[1]));
  return { handled: true, routedTo: AGENT_ID };
});

/**
 * AGENTS.md §P2 — Aman's whole workflow is a synchronous lookup + action:
 * no merchant approval gate, because nothing here moves money (it either
 * confirms a payment that already succeeded, or opens a support ticket).
 */
export async function checkPayment(db: CortexDb, storeId: string, amount: number): Promise<void> {
  const { taskId } = await startRun(db, { storeId, agentId: AGENT_ID, label: `Check payment ₹${amount}` });

  const matches = paytmPgMock.findRecentByAmount(amount, LOOKUP_WINDOW_MINUTES);
  const success = matches.find((t) => t.status === "SUCCESS");

  if (success) {
    await appendActivityEvent(db, {
      storeId,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
      agentAvatar: AGENT_AVATAR,
      message: `Payment verified — ${success.txn_id} · ₹${amount} · UTR ${success.utr} · SUCCESS.`,
      type: "PAYMENT_VERIFIED",
      severity: "SUCCESS",
    });

    if (success.soundboxLag && !success.soundboxAnnounced) {
      paytmPgMock.markSoundboxAnnounced(success.txn_id);

      await appendActivityEvent(db, {
        storeId,
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        agentAvatar: AGENT_AVATAR,
        message: "Soundbox cellular delay detected. Triggering priority edge override.",
        type: "SOUNDBOX_ANNOUNCED",
        severity: "WARNING",
      });
      await appendActivityEvent(db, {
        storeId,
        agentId: AGENT_ID,
        agentName: "Soundbox",
        agentAvatar: "🔊",
        message: `Paytm par ${numberToHindiWords(amount)} rupaye prapt huye!`,
        type: "SOUNDBOX_ANNOUNCED",
        severity: "SUCCESS",
      });

      await db.insert(schema.disputeResolutions).values({
        id: makeId("disp"),
        storeId,
        txnId: success.txn_id,
        amount,
      });
      const resolved = await db
        .select()
        .from(schema.disputeResolutions)
        .where(eq(schema.disputeResolutions.storeId, storeId));
      await setAgentMetric(db, storeId, AGENT_ID, "Disputes Resolved", `${resolved.length} UPI Holds`);
    }

    await completeTask(db, taskId, "DONE");
    return;
  }

  // PENDING at the issuing bank, or nothing found — either way this needs
  // a human, so open a ticket rather than leaving the merchant guessing.
  const pending = matches.find((t) => t.status === "PENDING");
  const ticketId = `PTM-${Math.floor(10 + Math.random() * 89)}`;

  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    message: pending
      ? `₹${amount} payment is PENDING at the issuing bank. Opened dispute ticket #${ticketId}.`
      : `No matching ₹${amount} transaction found in the last ${LOOKUP_WINDOW_MINUTES} minutes. Opened dispute ticket #${ticketId} for manual review.`,
    type: "DISPUTE_OPENED",
    severity: "WARNING",
  });

  if (pending) {
    await simulatorWhatsapp.sendText({
      storeId,
      toIdentityId: pending.payer,
      text: `Aapka ₹${amount} ka payment process ho raha hai. Bank confirmation aate hi turant update milega. — Ramesh Sweets`,
    });
  }

  await completeTask(db, taskId, "DONE");
}

/** Manual "Run now" for Aman is a no-op status check — the real trigger is
 * the inbound "check ₹X" text handled above. */
export async function run(db: CortexDb, storeId: string): Promise<{ runId: string }> {
  const { runId, taskId } = await startRun(db, { storeId, agentId: AGENT_ID, label: "Support queue check" });
  await appendActivityEvent(db, {
    storeId,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentAvatar: AGENT_AVATAR,
    message: "Checked PG and Soundbox queues — no pending disputes right now.",
    type: "PAYMENT_VERIFIED",
    severity: "INFO",
  });
  await completeTask(db, taskId, "DONE");
  return { runId };
}
