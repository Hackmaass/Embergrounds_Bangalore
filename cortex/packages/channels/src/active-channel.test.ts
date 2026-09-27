import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChannelAdapter, OutboundText } from "./adapter.js";
import { registerWhatsAppChannel, registerTelegramChannel, getActiveWhatsAppChannel, getActiveTelegramChannel, isAllowlistedSender } from "./active-channel.js";

/**
 * These lock in the default-deny safety gate. An earlier version of
 * active-channel.ts let a live send through unfiltered whenever
 * DEMO_WHATSAPP_RECIPIENT was unset — that shipped a real incident
 * (messages delivered to real strangers whose numbers happened to match
 * fake seeded demo data). This must never regress silently again.
 */
function fakeConnectedWhatsApp(): ChannelAdapter & { getStatus: () => { status: string }; sent: OutboundText[] } {
  const sent: OutboundText[] = [];
  return {
    channel: "WHATSAPP",
    mode: "LIVE",
    getStatus: () => ({ status: "CONNECTED" }),
    sent,
    async sendText(msg) {
      sent.push(msg);
    },
    async sendCard(card) {
      sent.push({ storeId: card.storeId, toIdentityId: card.toIdentityId, text: card.message });
    },
    async sendVoiceNote(note) {
      sent.push({ storeId: note.storeId, toIdentityId: note.toIdentityId, text: note.script });
    },
  };
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) prev[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("safety gate: no WHATSAPP_ALLOWLIST configured blocks every live send by default", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: undefined, DEMO_WHATSAPP_RECIPIENT: undefined }, async () => {
    const fake = fakeConnectedWhatsApp();
    registerWhatsAppChannel(fake);
    await getActiveWhatsAppChannel().sendText({ storeId: "s1", toIdentityId: "919812345678", text: "hi" });
    assert.equal(fake.sent.length, 0, "must not deliver to a non-allowlisted number by default");
  });
});

test("safety gate: a recipient not on the allowlist is blocked even with others allowlisted", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "919999999999", DEMO_WHATSAPP_RECIPIENT: undefined }, async () => {
    const fake = fakeConnectedWhatsApp();
    registerWhatsAppChannel(fake);
    await getActiveWhatsAppChannel().sendText({ storeId: "s1", toIdentityId: "919812345678", text: "hi" });
    assert.equal(fake.sent.length, 0);
  });
});

test("safety gate: an allowlisted recipient does receive the send", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "919812345678", DEMO_WHATSAPP_RECIPIENT: undefined }, async () => {
    const fake = fakeConnectedWhatsApp();
    registerWhatsAppChannel(fake);
    await getActiveWhatsAppChannel().sendText({ storeId: "s1", toIdentityId: "919812345678", text: "hi" });
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0]!.toIdentityId, "919812345678");
  });
});

test("safety gate: DEMO_WHATSAPP_RECIPIENT redirect is still blocked if the redirect target isn't allowlisted", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "919999999999", DEMO_WHATSAPP_RECIPIENT: "911111111111" }, async () => {
    const fake = fakeConnectedWhatsApp();
    registerWhatsAppChannel(fake);
    await getActiveWhatsAppChannel().sendText({ storeId: "s1", toIdentityId: "anyone", text: "hi" });
    assert.equal(fake.sent.length, 0, "redirect target must also be allowlisted, not exempt from the gate");
  });
});

test("safety gate: DEMO_WHATSAPP_RECIPIENT redirects to an allowlisted target and delivers", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "911111111111", DEMO_WHATSAPP_RECIPIENT: "911111111111" }, async () => {
    const fake = fakeConnectedWhatsApp();
    registerWhatsAppChannel(fake);
    await getActiveWhatsAppChannel().sendText({ storeId: "s1", toIdentityId: "some-fake-seeded-customer-id", text: "hi" });
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0]!.toIdentityId, "911111111111");
  });
});

test("safety gate: same default-deny applies to Telegram via TELEGRAM_ALLOWLIST", async () => {
  await withEnv({ TELEGRAM_ALLOWLIST: undefined, DEMO_TELEGRAM_RECIPIENT: undefined }, async () => {
    const fake: ChannelAdapter & { sent: OutboundText[] } = {
      channel: "TELEGRAM",
      mode: "LIVE",
      sent: [],
      async sendText(msg) {
        (this as { sent: OutboundText[] }).sent.push(msg);
      },
      async sendCard() {},
      async sendVoiceNote() {},
    };
    registerTelegramChannel(fake);
    await getActiveTelegramChannel().sendText({ storeId: "s1", toIdentityId: "12345678", text: "hi" });
    assert.equal(fake.sent.length, 0);
  });
});

// --- Inbound gate: a non-allowlisted sender's message must not be treated
// as the store owner (see apps/server/src/index.ts's use of this guard). ---

test("isAllowlistedSender: rejects a sender not on the allowlist", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "919999999999" }, async () => {
    assert.equal(isAllowlistedSender("WHATSAPP", "919812345678@s.whatsapp.net"), false);
  });
});

test("isAllowlistedSender: accepts an allowlisted sender regardless of JID formatting", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: "919812345678" }, async () => {
    assert.equal(isAllowlistedSender("WHATSAPP", "919812345678@s.whatsapp.net"), true);
  });
});

test("isAllowlistedSender: rejects everyone by default when no allowlist is configured", async () => {
  await withEnv({ WHATSAPP_ALLOWLIST: undefined, TELEGRAM_ALLOWLIST: undefined }, async () => {
    assert.equal(isAllowlistedSender("WHATSAPP", "919812345678@s.whatsapp.net"), false);
    assert.equal(isAllowlistedSender("TELEGRAM", "12345678"), false);
  });
});
