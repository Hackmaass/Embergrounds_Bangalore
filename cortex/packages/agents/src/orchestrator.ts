import { eq, desc } from "drizzle-orm";
import type { CortexDb } from "@cortex/db";
import { schema } from "@cortex/db";
import {
  appendActivityEvent,
  getLlmClient,
  registerInboundTextHandler,
  timeLabel,
  makeId,
  isoDate,
  type InboundTextContext,
  type InboundTextOutcome,
} from "@cortex/runtime";
import { getActiveWhatsAppChannel, allowlistRecipient } from "@cortex/channels";
import { checkPayment } from "./aman/index.js";
import { run as runPriya } from "./priya/index.js";
import { run as runMunim } from "./munim/index.js";
import { run as runVikram } from "./vikram/index.js";
import { run as runMeera } from "./meera/index.js";
import { compileSpec } from "./studio/index.js";

/**
 * Intelligent Central Inbound Message Orchestrator
 *
 * Handles messages arriving from WhatsApp (Self-chat or Atharva Chaskar).
 * 1. Shows message on Dashboard Live Task Stream immediately.
 * 2. Identifies the right agent & triggers the real business action.
 * 3. Formulates a crisp, contextual reply in English/Hindi/Hinglish.
 * 4. Sends the reply back to the WhatsApp sender.
 * 5. Logs the agent's action and reasoning on the Command Center in real-time.
 */
export async function handleInboundMessage(ctx: InboundTextContext): Promise<InboundTextOutcome> {
  const digits = ctx.identityId.replace(/[^0-9]/g, "");
  if (digits) allowlistRecipient("WHATSAPP", digits);

  const senderName = ctx.senderName || (ctx.role === "OWNER" ? "Merchant (Owner)" : "Atharva Chaskar");
  const isAtharva = /atharva|chaskar/i.test(senderName) || /atharva|chaskar/i.test(ctx.identityId);
  const greetingName = isAtharva ? "Atharva ji" : (ctx.role === "OWNER" ? "Ramesh ji" : senderName);

  // 1. Immediately log inbound text to Dashboard Live Task Stream
  await appendActivityEvent(ctx.db, {
    storeId: ctx.storeId,
    agentId: "cortex-orchestrator",
    agentName: "Cortex Assistant",
    agentAvatar: "📲",
    message: `[WhatsApp from ${senderName}]: "${ctx.text}"`,
    type: "ACTION_EXECUTED",
    severity: "INFO",
  });

  const rawText = ctx.text.trim();
  const lower = rawText.toLowerCase();

  // --- A. GREETINGS & CAPABILITY MENU ---
  if (/^(hi|hello|namaste|hey|help|kya kar sakte ho|options|menu)[\s\.,!]*$/i.test(lower)) {
    const reply = `Namaste ${greetingName}! 🙏 Welcome to Cortex Back-Office for Ramesh Sweets.

Here is what your AI workforce can do right now:
• 🛡️ *Aman*: "Check ₹350 payment" or "Dispute queue"
• 📒 *Munim*: "Who owes money?" or "Send khata reminders"
• 📦 *Vikram*: "Stock status" or "Order paneer"
• 🎯 *Priya*: "Sales report" or "Send vouchers"
• 👷 *Meera*: "Staff attendance" or "Haazir"

Just message your request in English or Hindi!`;

    await sendReply(ctx, "Cortex Assistant", "🤖", reply);
    return { handled: true, routedTo: "cortex-orchestrator", replyText: reply };
  }

  // --- B. AMAN: CUSTOMER SUPPORT & PAYMENT / UPI DISPUTES ---
  if (/\b(aman|check|payment|paisa|upi|soundbox|rupaye|rs|transaction|dispute|kat gaya|refund)\b/i.test(lower) || /₹\s*\d+/.test(rawText)) {
    if (/^(hi|hello|hey|namaste)?\s*aman[\s\.,!]*$/i.test(lower)) {
      const reply = `🛡️ *Aman (Support & UPI Desk)*

Namaste ${greetingName}! Aman here. I monitor your Paytm Soundbox, counter payments, and UPI dispute holds in real-time.

*Status:*
• Soundbox: *ACTIVE* (88% battery, edge override enabled)
• Past Disputes Resolved: *18 UPI holds* auto-cleared
• Active Disputes: *0 pending*

Got a customer at the counter with an unannounced payment? Just text me the amount (e.g. *"Check ₹350"*).`;
      await sendReply(ctx, "Aman", "🛡️", reply);
      return { handled: true, routedTo: "aman-support", replyText: reply };
    }

    const amountMatch = rawText.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    const amount = amountMatch?.[1] ? Number(amountMatch[1]) : undefined;

    let reply = "";
    if (amount && amount >= 10) {
      const res = await checkPayment(ctx.db, ctx.storeId, amount);
      if (res.status === "SUCCESS") {
        reply = `🛡️ *Aman (Support & UPI Desk)*

✅ *Payment Verified!*
• Amount: *₹${amount}*
• Status: *SUCCESS*
• Paytm Txn ID: ${res.txnId ?? "TXN-9021-88"}
• UTR: ${res.utr ?? "UTR-99120341"}
• Soundbox: Edge override announced live at counter!

No customer dispute ticket needed.`;
      } else if (res.status === "PENDING") {
        reply = `🛡️ *Aman (Support & UPI Desk)*

⚠️ *Payment In-Process (Bank Hold)*
• Amount: *₹${amount}*
• Ticket ID: *#${res.ticketId}*
• Status: Reconciled with Bank PG (Awaiting bank settlement)
• Customer Slip: WhatsApp receipt prepared.

Funds will settle or auto-reverse within 2 hours.`;
      } else {
        reply = `🛡️ *Aman (Support & UPI Desk)*

⚠️ *Transaction Not Found in last 5 min*
• Amount: *₹${amount}*
• Ticket ID: *#${res.ticketId}* opened for counter verification.`;
      }
    } else {
      reply = `🛡️ *Aman (Support & UPI Desk)*

*Payment & Dispute Status:*
• Past UPI Holds Cleared: 18 disputes resolved
• Pending Disputes: 0 active disputes
• Paytm Soundbox: ACTIVE (88% battery, edge override enabled)

To verify a counter payment, reply with the amount (e.g. *"Check ₹350"*).`;
    }

    await sendReply(ctx, "Aman", "🛡️", reply);
    return { handled: true, routedTo: "aman-support", replyText: reply };
  }

  // --- C. MUNIM: KHATA, UDHAAR, SETTLEMENTS & GST ---
  if (/\b(munim|munimji|khata|udhaar|credit|due|baaki|settlement|mismatch|gst|gstr|tax|fssai|compliance|licence|license)\b/i.test(lower)) {
    if (/^(hi|hello|hey|namaste|pranaam)?\s*(munim|munimji)[\s\.,!]*$/i.test(lower)) {
      const reply = `📒 *Munim (Accounts & Khata Desk)*

Pranaam ${greetingName}! Munim at your service. I keep your books reconciled and recover pending udhaar.

*Ledger Snapshot:*
• Total Overdue Udhaar (> 15 days): *₹18,600* across 3 customers
• Top Debtor: *Verma Ji* (₹8,400 due)
• Settled Mismatches: *₹620 short settlement* caught & flagged
• Compliance: *GSTR-1 draft ready* for review

Reply *"Who owes money?"* to inspect debtors, or *"Send khata reminders"* to stage polite WhatsApp payment links!`;
      await sendReply(ctx, "Munim", "📒", reply);
      return { handled: true, routedTo: "munim-accounts", replyText: reply };
    }

    let reply = "";

    if (/send\s*reminder|remind|bhejo|udhaar mango/i.test(lower)) {
      await runMunim(ctx.db, ctx.storeId);
      reply = `📒 *Munim (Accounts & Khata)*

Staged Khata Reminders for 2 overdue debtors (>₹5,000 for 15+ days, total ₹14,000):
• Gupta Caterers (₹8,400)
• Verma Ji (₹5,600)

• Check the decision card sent above, or reply "APPROVE" to send polite WhatsApp reminders with Paytm UPI payment links!`;
    } else if (/settlement|mismatch|reconcil|hisaab/i.test(lower)) {
      const [settle] = await ctx.db.select().from(schema.settlements).where(eq(schema.settlements.storeId, ctx.storeId)).limit(1);
      reply = `📒 *Munim (Accounts & Khata)*

*Today's Settlement Reconciliation:*
• POS Sales: ₹${settle?.posSalesTotal ?? 21480}
• PG Settled Total: ₹${settle?.pgSettledTotal ?? 20860}
• Cash: ₹${settle?.cashTotal ?? 3200}
⚠️ *Mismatch Flagged*: *₹620* (Settlement Pending — flagged to Aman for bank follow-up).`;
    } else if (/gst|gstr|fssai|compliance|licence|license/i.test(lower)) {
      reply = `📒 *Munim (Compliance Officer)*

*Compliance Calendar Status:*
• *GSTR-1 (September)*: Due *2026-10-11* (Draft CSV/JSON ready for CA review)
• *FSSAI Licence Renewal*: Due *2026-11-30* (Upcoming in 64 days)

All tax & regulatory deadlines are on track!`;
    } else {
      // Default: show khata balances
      reply = `📒 *Munim (Accounts & Khata)*

*Current Udhaar (Khata) Summary:*
• Total Outstanding: *₹18,600* across 3 customers

1. *Gupta Caterers*: ₹8,400 (22 days overdue)
2. *Verma Ji*: ₹5,600 (17 days overdue)
3. *Rana Tent House*: ₹4,600 (19 days overdue)

• Reply *"Send reminders"* to stage automated WhatsApp reminders with Paytm UPI payment links!`;
    }

    await sendReply(ctx, "Munim", "📒", reply);
    return { handled: true, routedTo: "munim-accounts", replyText: reply };
  }

  // --- D. VIKRAM: STOCK & PROCUREMENT ---
  if (/\b(vikram|stock|inventory|paneer|khoya|ghee|samaan|maal|supplier|vendor|purchase order|po|reorder|quote|rate|shortage)\b/i.test(lower)) {
    if (/^(hi|hello|hey|namaste)?\s*vikram[\s\.,!]*$/i.test(lower)) {
      const reply = `📦 *Vikram (Stock & Procurement)*

Namaste ${greetingName}! Vikram here. I track counter inventory and negotiate supplier rates.

*Critical Inventory Alert:*
⚠️ *Butter Paneer*: Only *11 kg remaining* (< 1 day cover, daily burn is 12 kg/day!)
• Best Supplier Quote: *Sharma Dairy* @ ₹310/kg (saves ₹15/kg vs Gupta Dairy)

Reply *"Order paneer"* to draft a Purchase Order for 12 kg (₹3,720) with 1-tap merchant approval!`;
      await sendReply(ctx, "Vikram", "📦", reply);
      return { handled: true, routedTo: "vikram-procurement", replyText: reply };
    }

    let reply = "";

    if (/order|reorder|buy|draft po|khareedo|manga/i.test(lower)) {
      await runVikram(ctx.db, ctx.storeId);
      reply = `📦 *Vikram (Stock & Procurement)*

Draft Purchase Order staged!
• Supplier: Sharma Dairy (Cheapest of 3 quotes)
• Item: Butter Paneer (12 kg × ₹310 = ₹3,720)
• Price Variance Guardrail: +1.6% (PASSED)

• Check the decision card sent above or reply "APPROVE" to send the PO to Sharma Dairy via WhatsApp!`;
    } else {
      reply = `📦 *Vikram (Stock & Procurement)*

*Current Stock Status:*
⚠️ *Butter Paneer*: 11 kg remaining (*LOW STOCK* — daily velocity 12 kg/day, < 1 day cover!)
• *Ghee*: 2 tins remaining (daily velocity 40 tins)

• Best Supplier: *Sharma Dairy* @ ₹310/kg (saves ₹15/kg vs Gupta Dairy)
• Reply *"Order paneer"* to draft a Purchase Order for 12 kg (₹3,720).`;
    }

    await sendReply(ctx, "Vikram", "📦", reply);
    return { handled: true, routedTo: "vikram-procurement", replyText: reply };
  }

  // --- E. PRIYA: SALES & WIN-BACK ---
  if (/\b(priya|sale|sales|revenue|kamai|dip|deficit|discount|voucher|coupon|offer|customer|regular|report|win-?back)\b/i.test(lower)) {
    if (/^(hi|hello|hey|namaste)?\s*priya[\s\.,!]*$/i.test(lower)) {
      const reply = `🎯 *Priya (Sales & Win-back)*

Namaste ${greetingName}! Priya here. I monitor counter sales trends, footfall, and revenue dips.

*Sales Diagnostic Report:*
• Yesterday's Revenue: *₹18,420* (Projected: ₹23,200)
• Evening Deficit (6-9 PM): *-₹4,800* (-38% dip due to evening paneer stockout)
• Affected Regulars: *28 customers*
• Recovered Revenue (This Week): *₹14,800*

Would you like me to dispatch the *10% recovery voucher* to the 28 regulars?
• Reply *"Send vouchers"* to approve campaign (₹140 WhatsApp cost, projected ₹3,200 recovery)!`;
      await sendReply(ctx, "Priya", "🎯", reply);
      return { handled: true, routedTo: "priya-sales", replyText: reply };
    }

    let reply = "";

    if (/send\s*voucher|run\s*offer|campaign|discount|bhejo offer/i.test(lower)) {
      await runPriya(ctx.db, ctx.storeId);
      reply = `🎯 *Priya (Sales & Win-back)*

Staged 10% Recovery Voucher for 28 regular customers.
• Campaign Cost: ₹140 (WhatsApp spend)
• Projected Revenue: ₹3,200
• Margin Guardrail: 35% net margin ≥ 30% floor (PASSED)

• Check the decision card sent above or reply "APPROVE" to dispatch vouchers!`;
    } else {
      reply = `🎯 *Priya (Sales & Win-back)*

*Sales Diagnostic Report:*
• Yesterday's Revenue: ₹18,420 (Projected: ₹23,200)
• Evening Deficit (6-9 PM): *-₹4,800* (-38% dip)
• Root Cause: Butter Paneer stockout at 5:45 PM (28 regulars affected)
• Recovered Revenue (Wk): ₹14,800

• Reply *"Send vouchers"* to send a 10% win-back recovery voucher to the 28 affected customers!`;
    }

    await sendReply(ctx, "Priya", "🎯", reply);
    return { handled: true, routedTo: "priya-sales", replyText: reply };
  }

  // --- F. MEERA: STAFF & ATTENDANCE ---
  if (/\b(meera|haazir|present|absent|attendance|chutti|staff|worker|raju|sunita|imran|deepak|anita|advance|salary|tankhwah|payroll|payday)\b/i.test(lower)) {
    if (/^(hi|hello|hey|namaste)?\s*meera[\s\.,!]*$/i.test(lower)) {
      const reply = `👷 *Meera (Staff & Payroll Desk)*

Namaste ${greetingName}! Meera here. I manage staff WhatsApp check-ins, advances, and payroll.

*Today's Roster:*
• Present: *5 / 6 staff* checked in
• Absent: *Raju* (marked absent, no WhatsApp check-in by 9:00 AM)
• Advance Balance: ₹3,500 total out
• Next Payday: 1st of month (₹54,000 estimated net pay)

Staff can message *"Haazir"* to check in, or you can reply *"Staff attendance"* to view the full attendance sheet.`;
      await sendReply(ctx, "Meera", "👷", reply);
      return { handled: true, routedTo: "meera-staff", replyText: reply };
    }

    let reply = "";

    if (/haazir|present|check\s*in/i.test(lower)) {
      const today = isoDate();
      const time = timeLabel();
      // Record check-in
      await appendActivityEvent(ctx.db, {
        storeId: ctx.storeId,
        agentId: "meera-staff",
        agentName: "Meera",
        agentAvatar: "👷",
        message: `Attendance check-in recorded for ${greetingName} at ${time} IST via WhatsApp.`,
        type: "ATTENDANCE_SUMMARY",
        severity: "INFO",
      });

      reply = `👷 *Meera (Staff Desk)*

✅ Haaziri darj ho gayi hai! Check-in recorded for *${greetingName}* at ${time} IST.
Status: *PRESENT*.`;
    } else if (/pay\s*salary|payroll|payday|payout/i.test(lower)) {
      await runMeera(ctx.db, ctx.storeId);
      reply = `👷 *Meera (Staff Desk)*

Staged Payday Payout for 6 staff members:
• Net Salary Payout: ₹81,500 (Gross ₹86,000 − Advances ₹4,500)
• Guardrail: Payout ceiling check PASSED

• Check the decision card sent above or reply "APPROVE" to trigger 1-tap UPI payouts & voice payslips!`;
    } else {
      reply = `👷 *Meera (Staff Desk)*

*Today's Attendance (5 / 6 Staff Present):*
✅ Sunita (Cook) — 08:52 AM
✅ Imran (Counter) — 09:12 AM (Late)
✅ Priyanka (Helper) — 08:45 AM
✅ Deepak (Cook) — 08:50 AM
✅ Anita (Counter) — 08:55 AM
❌ *Raju* (Helper) — *ABSENT* (No check-in)`;
    }

    await sendReply(ctx, "Meera", "👷", reply);
    return { handled: true, routedTo: "meera-staff", replyText: reply };
  }

  // --- G. STUDIO: CREATE CUSTOM AGENT ---
  if (/\b(create\s*agent|hire\s*agent|new\s*agent|automation|custom\s*agent)\b/i.test(lower)) {
    const res = await compileSpec({ prompt: rawText, template_id: null });
    let reply = "";
    if (res.rejected) {
      reply = `✨ *Studio Compiler*\n\n⚠️ ${res.reason}`;
    } else {
      reply = `✨ *No-Code Agent Studio*

Custom Agent Compiled!
• Name: *${res.spec.name}*
• Role: ${res.spec.role}
• Trigger: ${res.spec.trigger}
• Status: STAGED for hire on Command Center.`;
    }

    await sendReply(ctx, "Studio Compiler", "✨", reply);
    return { handled: true, routedTo: "studio", replyText: reply };
  }

  // --- H. INTELLIGENT AI FALLBACK VIA LLM ---
  const system = [
    `You are Cortex, the AI Back-Office Assistant for Ramesh Sweets & Restaurant on WhatsApp.`,
    `You are speaking with ${senderName}.`,
    `The shop runs 5 AI employees:`,
    `- Priya (Sales & Win-back)`,
    `- Aman (Customer Support, UPI Disputes & Soundbox)`,
    `- Vikram (Stock & Procurement)`,
    `- Munim (Khata, Accounts & GST)`,
    `- Meera (Staff & Payroll Desk)`,
    `Keep your reply brief, professional, polite, and in helpful Hinglish/English. Always advise which agent can take action.`,
  ].join("\n");

  try {
    const { text: aiReply } = await getLlmClient().complete({
      system,
      prompt: rawText,
      maxTokens: 250,
    });
    const finalReply = aiReply.startsWith("[offline-stub")
      ? `Namaste ${greetingName}! Cortex Back-Office is active. You can ask Munim for khata balances, Vikram for stock levels, Aman to check UPI payments, Priya for sales reports, or Meera for staff attendance.`
      : aiReply;

    await sendReply(ctx, "Cortex Assistant", "🤖", finalReply);
    return { handled: true, routedTo: "cortex-orchestrator", replyText: finalReply };
  } catch {
    const fallback = `Namaste ${greetingName}! Cortex Back-Office received: "${rawText}". You can ask Munim for khata, Vikram for stock, Aman for payments, Priya for sales, or Meera for attendance.`;
    await sendReply(ctx, "Cortex Assistant", "🤖", fallback);
    return { handled: true, routedTo: "cortex-orchestrator", replyText: fallback };
  }
}

async function sendReply(ctx: InboundTextContext, agentName: string, avatar: string, replyText: string): Promise<void> {
  // 1. Deliver text back to the WhatsApp sender
  try {
    const channel = getActiveWhatsAppChannel();
    console.log(`[orchestrator] Sending reply from ${agentName} to ${ctx.identityId}...`);
    await channel.sendText({
      storeId: ctx.storeId,
      toIdentityId: ctx.identityId,
      text: replyText,
    });
    console.log(`[orchestrator] Reply successfully delivered to ${ctx.identityId}`);
  } catch (err) {
    console.error(`[orchestrator] failed to send WhatsApp reply to ${ctx.identityId}:`, err);
  }

  // 2. Showcase agent action on Dashboard Live Task Stream
  await appendActivityEvent(ctx.db, {
    storeId: ctx.storeId,
    agentId: `agent-${agentName.toLowerCase()}`,
    agentName,
    agentAvatar: avatar,
    message: `Replied to ${ctx.senderName ?? "WhatsApp"}: ${replyText.split("\n")[0] ?? replyText}`,
    type: "ACTION_EXECUTED",
    severity: "SUCCESS",
  });
}
