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

/**
 * Seeded demo customers/staff/suppliers carry fake phone numbers/ids that
 * cannot receive anything real. When set, DEMO_WHATSAPP_RECIPIENT /
 * DEMO_TELEGRAM_RECIPIENT redirect every live send to one real,
 * presenter-controlled number/chat, so a live demo can show genuine
 * delivery without ever messaging a real stranger's number.
 */
function withDemoOverride(channel: ChannelAdapter, overrideId: string | undefined): ChannelAdapter {
  if (!overrideId) return channel;
  return {
    channel: channel.channel,
    mode: channel.mode,
    sendText: (msg) => channel.sendText({ ...msg, toIdentityId: overrideId }),
    sendCard: (card) => channel.sendCard({ ...card, toIdentityId: overrideId }),
    sendVoiceNote: (note) => channel.sendVoiceNote({ ...note, toIdentityId: overrideId }),
  };
}

export function getActiveWhatsAppChannel(): ChannelAdapter {
  if (whatsappChannel && whatsappChannel.getStatus().status === "CONNECTED") {
    return withDemoOverride(whatsappChannel, process.env.DEMO_WHATSAPP_RECIPIENT);
  }
  return simulatorWhatsapp;
}

export function getActiveTelegramChannel(): ChannelAdapter {
  if (telegramChannel) {
    return withDemoOverride(telegramChannel, process.env.DEMO_TELEGRAM_RECIPIENT);
  }
  return simulatorTelegram;
}

/** Raw link status of the registered WhatsApp channel (for a status/QR
 * endpoint) — distinct from getActiveWhatsAppChannel(), which resolves to
 * whichever adapter agent sends should actually go through right now. */
export function getWhatsAppLinkStatus(): { status: string; qr?: string } {
  return whatsappChannel?.getStatus() ?? { status: "DISCONNECTED" };
}
