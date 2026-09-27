import type { ChannelAdapter } from "./adapter.js";
import { simulatorWhatsapp, simulatorTelegram } from "./simulator.js";

interface StatusAware {
  getStatus(): { status: string };
}

let whatsappChannel: (ChannelAdapter & StatusAware) | undefined;
let telegramChannel: ChannelAdapter | undefined;

/** Called once at boot with the live WhatsApp adapter (BaileysWhatsAppChannel).
 * getActiveWhatsAppChannel() only ever returns it once actually linked —
 * every agent send stays routed to the simulator until then. */
export function registerWhatsAppChannel(channel: ChannelAdapter & StatusAware): void {
  whatsappChannel = channel;
}

/** Telegram has no QR-link handshake — registering it makes it active
 * immediately (a bad token surfaces as a thrown error on send, not silence). */
export function registerTelegramChannel(channel: ChannelAdapter): void {
  telegramChannel = channel;
}

function digitsOf(identityId: string): string {
  return identityId.replace(/[^0-9]/g, "");
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => digitsOf(s.trim()))
      .filter(Boolean),
  );
}

/**
 * The outbound gate above stops us messaging a stranger — it does nothing
 * about a stranger messaging us. Every inbound WhatsApp/Telegram event is
 * currently dispatched as role:"OWNER" (single-owner demo assumption), so
 * anyone who ever received an outbound message (or messages this number
 * for any other reason) can otherwise have their reply processed as the
 * merchant. Call this at the point an inbound event is received and drop
 * it if it fails — same allowlist as the outbound gate, same default-deny.
 */
export function isAllowlistedSender(channel: "WHATSAPP" | "TELEGRAM", identityId: string): boolean {
  const allowlist = parseAllowlist(channel === "WHATSAPP" ? process.env.WHATSAPP_ALLOWLIST : process.env.TELEGRAM_ALLOWLIST);
  return allowlist.has(digitsOf(identityId));
}

/**
 * DEFAULT-DENY safety gate. Seeded demo customers/staff/suppliers carry
 * fake-looking phone numbers, but WhatsApp/Telegram have no concept of
 * "fake" — if a number happens to belong to a real account, a live send
 * reaches a real stranger. An earlier version of this file only redirected
 * sends when DEMO_WHATSAPP_RECIPIENT was set and let them through
 * unfiltered otherwise; that shipped a real incident (messages sent to
 * people who never agreed to receive anything from this demo).
 *
 * Now: nothing is sent live unless the resolved recipient's digits are in
 * WHATSAPP_ALLOWLIST / TELEGRAM_ALLOWLIST. No allowlist configured = every
 * live send is blocked (logged, not delivered) until you explicitly opt a
 * number in. DEMO_WHATSAPP_RECIPIENT / DEMO_TELEGRAM_RECIPIENT still
 * redirects every send to one number for convenience, but that redirected
 * number is checked against the allowlist too — misconfiguring the
 * redirect can never bypass the gate.
 */
function withSafetyGate(channel: ChannelAdapter, overrideId: string | undefined, allowlistRaw: string | undefined): ChannelAdapter {
  const allowlist = parseAllowlist(allowlistRaw);

  function resolve(requestedId: string): string | undefined {
    const target = overrideId ?? requestedId;
    const digits = digitsOf(target);
    if (!allowlist.has(digits)) {
      console.error(
        `[safety] BLOCKED live ${channel.channel} send to "${target}" — not in the allowlist. ` +
          `Set WHATSAPP_ALLOWLIST / TELEGRAM_ALLOWLIST (comma-separated numbers) to permit specific recipients. Nothing was sent.`,
      );
      return undefined;
    }
    return target;
  }

  return {
    channel: channel.channel,
    mode: channel.mode,
    async sendText(msg) {
      const target = resolve(msg.toIdentityId);
      if (!target) return;
      await channel.sendText({ ...msg, toIdentityId: target });
    },
    async sendCard(card) {
      const target = resolve(card.toIdentityId);
      if (!target) return;
      await channel.sendCard({ ...card, toIdentityId: target });
    },
    async sendVoiceNote(note) {
      const target = resolve(note.toIdentityId);
      if (!target) return;
      await channel.sendVoiceNote({ ...note, toIdentityId: target });
    },
  };
}

export function getActiveWhatsAppChannel(): ChannelAdapter {
  if (whatsappChannel && whatsappChannel.getStatus().status === "CONNECTED") {
    return withSafetyGate(whatsappChannel, process.env.DEMO_WHATSAPP_RECIPIENT, process.env.WHATSAPP_ALLOWLIST);
  }
  return simulatorWhatsapp;
}

export function getActiveTelegramChannel(): ChannelAdapter {
  if (telegramChannel) {
    return withSafetyGate(telegramChannel, process.env.DEMO_TELEGRAM_RECIPIENT, process.env.TELEGRAM_ALLOWLIST);
  }
  return simulatorTelegram;
}

/** Raw link status of the registered WhatsApp channel (for a status/QR
 * endpoint) — distinct from getActiveWhatsAppChannel(), which resolves to
 * whichever adapter agent sends should actually go through right now. */
export function getWhatsAppLinkStatus(): { status: string; qr?: string } {
  return whatsappChannel?.getStatus() ?? { status: "DISCONNECTED" };
}
