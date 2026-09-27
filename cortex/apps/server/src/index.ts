import express from "express";
import cors from "cors";
import { getDb, seedDemoStore, DEMO_STORE_ID } from "@cortex/db";
import { AGENT_RUNNERS } from "@cortex/agents"; // side effect: registers decision executors
import { activityBus, decideDecision, dispatchInboundText, Scheduler } from "@cortex/runtime";
import {
  getVoiceProvider,
  pollTelegramUpdates,
  BaileysWhatsAppChannel,
  TelegramChannel,
  registerWhatsAppChannel,
  registerTelegramChannel,
  getActiveWhatsAppChannel,
  getActiveTelegramChannel,
  isAllowlistedSender,
} from "@cortex/channels";
import type { ActivityEvent } from "@cortex/shared";
import { cortexRouter } from "./routes/cortex.routes.js";
import { demoRouter } from "./routes/demo.routes.js";
import { channelsRouter } from "./routes/channels.routes.js";
import { accountsRouter } from "./routes/accounts.routes.js";
import { procurementRouter } from "./routes/procurement.routes.js";
import { staffRouter } from "./routes/staff.routes.js";
import { studioRouter } from "./routes/studio.routes.js";

const PORT = Number(process.env.PORT ?? 3200);

async function main(): Promise<void> {
  const db = await getDb();
  await seedDemoStore(db);

  // Control-plane scheduler (AGENTS.md P0 + §3.2): each agent's documented
  // cron trigger, wired to the same AGENT_RUNNERS map manual "Run now" uses.
  // Coalesce-if-active and skip-missed are handled inside Scheduler itself.
  const scheduler = new Scheduler();
  const DAILY_ROUTINES: Array<{ id: string; agentId: string; time: string }> = [
    { id: "priya-sales-0700", agentId: "priya-sales", time: "07:00" },
    { id: "meera-staff-0905", agentId: "meera-staff", time: "09:05" },
    { id: "munim-accounts-1100", agentId: "munim-accounts", time: "11:00" },
    { id: "vikram-procurement-1800", agentId: "vikram-procurement", time: "18:00" },
    { id: "munim-accounts-2100", agentId: "munim-accounts", time: "21:00" },
  ];
  let registeredCount = 0;
  for (const routine of DAILY_ROUTINES) {
    const runner = AGENT_RUNNERS[routine.agentId];
    if (!runner) {
      console.error(`[scheduler] no runner registered for agentId "${routine.agentId}" — routine "${routine.id}" will never fire`);
      continue;
    }
    registeredCount += 1;
    scheduler.register({
      id: routine.id,
      label: `${routine.agentId} @ ${routine.time} IST`,
      schedule: { type: "DAILY", time: routine.time },
      handler: async () => {
        await runner(db, DEMO_STORE_ID);
      },
    });
  }
  scheduler.register({
    id: "meera-staff-payday",
    label: "meera-staff payday @ 1st, 09:00 IST",
    schedule: { type: "MONTHLY", day: 1, time: "09:00" },
    handler: async () => {
      await AGENT_RUNNERS["meera-staff"]!(db, DEMO_STORE_ID);
    },
  });
  registeredCount += 1;
  scheduler.start();
  console.log(`Scheduler started: ${registeredCount} routine(s) registered`);

  // Soundbox: every SOUNDBOX_ANNOUNCED activity event is spoken aloud via
  // OS TTS (AGENTS.md §3.3 offline fallback) — decoupled from the decision
  // engine itself, which only knows it appended an activity event.
  const voice = getVoiceProvider();
  activityBus.on("activity", (event: { type: string; message: string }) => {
    if (event.type === "SOUNDBOX_ANNOUNCED") void voice.speak(event.message);
  });

  // Telegram long-polling — only starts when a real bot token is
  // configured; otherwise the channel stays SIMULATOR (seed.ts) and the
  // demo is unaffected. Not verifiable in this environment (no bot token).
  const telegramAbort = new AbortController();
  if (process.env.TELEGRAM_BOT_TOKEN) {
    registerTelegramChannel(new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN));
    void pollTelegramUpdates(process.env.TELEGRAM_BOT_TOKEN, DEMO_STORE_ID, async (event) => {
      // The outbound safety gate stops us messaging a stranger; this stops
      // a stranger's message being processed as the store owner. Same
      // allowlist, same default-deny — see @cortex/channels active-channel.ts.
      if (!isAllowlistedSender("TELEGRAM", event.identityId)) {
        console.error(`[safety] ignored inbound TELEGRAM message from non-allowlisted sender "${event.identityId}"`);
        return;
      }
      if (event.kind === "BUTTON" && event.button) {
        await decideDecision(db, { decisionId: event.button.decisionId, storeId: DEMO_STORE_ID, action: event.button.action, source: "TELEGRAM" });
      } else if (event.kind === "TEXT" && event.text) {
        await dispatchInboundText({ db, storeId: DEMO_STORE_ID, role: event.role, identityId: event.identityId, text: event.text });
      }
    }, telegramAbort.signal).catch((err) => console.error("[telegram] polling loop crashed:", err));
  }

  // WhatsApp via Baileys (OpenClaw's approach — QR-linked WhatsApp Web
  // protocol, no Meta business verification needed). Always attempts to
  // link; getActiveWhatsAppChannel() only ever returns it once actually
  // CONNECTED, so every agent send stays on the SIMULATOR until then —
  // never blocks the demo on a QR scan that may never happen.
  const whatsapp = new BaileysWhatsAppChannel(process.env.WHATSAPP_AUTH_DIR ?? ".baileys-auth");
  registerWhatsAppChannel(whatsapp);
  void whatsapp
    .connect(DEMO_STORE_ID, async (event) => {
      // Same reasoning as the Telegram inbound gate above: anyone who ever
      // received a message from this number (or messages it unprompted)
      // must not have their reply processed as the store owner.
      if (!isAllowlistedSender("WHATSAPP", event.identityId)) {
        console.error(`[safety] ignored inbound WHATSAPP message from non-allowlisted sender "${event.identityId}"`);
        return;
      }
      if (event.kind === "BUTTON" && event.button) {
        await decideDecision(db, { decisionId: event.button.decisionId, storeId: DEMO_STORE_ID, action: event.button.action, source: "WHATSAPP" });
      } else if (event.kind === "TEXT" && event.text) {
        await dispatchInboundText({ db, storeId: DEMO_STORE_ID, role: event.role, identityId: event.identityId, text: event.text });
      }
    })
    .catch((err) => console.error("[whatsapp] failed to start:", err));

  // Push every staged decision (the "1-tap approve" card) to whichever live
  // channel is connected — DEMO_WHATSAPP_RECIPIENT / DEMO_TELEGRAM_RECIPIENT
  // decide the real destination (see @cortex/channels active-channel.ts);
  // without one set, this attempts a placeholder identity and fails
  // safely (caught, logged) exactly like the per-agent sends above.
  activityBus.on("activity", (event: ActivityEvent) => {
    if (event.type !== "DECISION_STAGED" || !event.decision_id) return;
    const card = {
      storeId: DEMO_STORE_ID,
      toIdentityId: "owner",
      agentName: event.agent_name,
      agentAvatar: event.agent_avatar,
      message: event.message,
      decisionId: event.decision_id,
      decisionKind: event.decision_kind,
      buttons: event.buttons,
    };
    getActiveWhatsAppChannel()
      .sendCard(card)
      .catch((err) => console.error("[whatsapp] failed to push decision card:", err));
    if (process.env.TELEGRAM_BOT_TOKEN) {
      getActiveTelegramChannel()
        .sendCard(card)
        .catch((err) => console.error("[telegram] failed to push decision card:", err));
    }
  });

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/cortex", cortexRouter(db));
  app.use("/api/cortex", accountsRouter(db));
  app.use("/api/cortex", procurementRouter(db));
  app.use("/api/cortex", staffRouter(db));
  app.use("/api/cortex", studioRouter(db));
  app.use("/api/demo", demoRouter(db));
  app.use("/api/channels", channelsRouter(db));

  app.listen(PORT, () => {
    console.log(`Cortex server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal error booting Cortex server:", err);
  process.exit(1);
});
