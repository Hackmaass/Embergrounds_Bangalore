import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import type { IdentityRole } from "@cortex/shared";
import type { ChannelAdapter, InboundEvent, OutboundCard, OutboundText, OutboundVoiceNote } from "./adapter.js";

export type WhatsAppLinkStatus = "DISCONNECTED" | "QR_PENDING" | "CONNECTED";

/**
 * WhatsApp via Baileys — the same approach OpenClaw uses: an unofficial,
 * reverse-engineered WhatsApp Web protocol client, linked by scanning a QR
 * code (WhatsApp -> Settings -> Linked Devices -> Link a Device), instead
 * of Meta's Business Cloud API. No business verification needed, which is
 * why this is the path wired for the demo (see WhatsAppChannel in
 * whatsapp.ts for the Meta Cloud API path this was originally built
 * against — kept as reference, not currently instantiated).
 *
 * This is NOT Meta's sanctioned API. WhatsApp's ToS technically disallows
 * unofficial clients, and automated use can get a number flagged — use a
 * secondary/test number, never a primary one.
 *
 * Approve/reject buttons: WhatsApp deprecated interactive button rendering
 * for unofficial clients, so decision cards are sent as plain text asking
 * the owner to reply "APPROVE <decisionId>" / "REJECT <decisionId>" —
 * parsed back out in handleInbound below.
 */
export class BaileysWhatsAppChannel implements ChannelAdapter {
  readonly channel = "WHATSAPP" as const;
  readonly mode = "LIVE" as const;

  private sock: WASocket | undefined;
  private status: WhatsAppLinkStatus = "DISCONNECTED";
  private qrDataUrl: string | undefined;
  private onEvent: ((event: InboundEvent) => Promise<void>) | undefined;
  private storeId = "";
  private botSentMessageIds = new Set<string>();
  private atharvaJids = new Set<string>();

  constructor(private readonly authDir: string) {}

  getStatus(): { status: WhatsAppLinkStatus; qr?: string } {
    return { status: this.status, qr: this.qrDataUrl };
  }

  async connect(storeId: string, onEvent: (event: InboundEvent) => Promise<void>): Promise<void> {
    this.storeId = storeId;
    this.onEvent = onEvent;
    await this.open();
  }

  private async open(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: "silent" });

    const sock = makeWASocket({ version, auth: state, logger });
    this.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      void this.handleConnectionUpdate(update);
    });

    sock.ev.on("messages.upsert", ({ messages, type }) => {
      // "notify" = a live incoming message. A fresh link also replays chat
      // history under other types — without this guard, a prior demo's
      // "APPROVE dec-xxx" reply gets re-dispatched on every relink.
      if (type !== "notify") return;
      for (const msg of messages) {
        void this.handleInbound(msg);
      }
    });
  }

  private async handleConnectionUpdate(update: {
    connection?: "open" | "connecting" | "close";
    lastDisconnect?: { error?: unknown };
    qr?: string;
  }): Promise<void> {
    if (update.qr) {
      this.status = "QR_PENDING";
      try {
        this.qrDataUrl = await QRCode.toDataURL(update.qr);
        const terminalArt = await QRCode.toString(update.qr, { type: "terminal", small: true });
        console.log("[whatsapp] Scan with WhatsApp -> Linked Devices -> Link a Device:");
        console.log(terminalArt);
        console.log("[whatsapp] (or GET /api/channels/whatsapp/status for a scannable image)");
      } catch (err) {
        console.error("[whatsapp] failed to render QR:", err);
      }
    }

    if (update.connection === "open") {
      this.status = "CONNECTED";
      this.qrDataUrl = undefined;
      const userPhone = this.sock?.user?.id?.replace(/[^0-9]/g, "");
      if (userPhone) {
        const { allowlistRecipient } = await import("./active-channel.js");
        allowlistRecipient("WHATSAPP", userPhone);
      }
      console.log("[whatsapp] Linked and connected.");
    } else if (update.connection === "close") {
      this.status = "DISCONNECTED";
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;

      this.sock?.ev.removeAllListeners("connection.update");
      this.sock?.ev.removeAllListeners("creds.update");
      this.sock?.ev.removeAllListeners("messages.upsert");

      if (statusCode === DisconnectReason.loggedOut) {
        console.error(`[whatsapp] Logged out — delete "${this.authDir}" and restart to re-link.`);
        return;
      }

      const delayMs = statusCode === DisconnectReason.restartRequired ? 0 : 5_000;
      console.error(`[whatsapp] Connection closed (code ${statusCode ?? "unknown"}), reconnecting in ${delayMs}ms...`);
      setTimeout(() => void this.open(), delayMs);
    }
  }

  private async handleInbound(msg: WAMessage): Promise<void> {
    if (!this.onEvent || !msg.message) return;
    const jid = msg.key.remoteJid;
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return; // ignore group chats and broadcasts

    // Ignore messages sent by our bot
    if (msg.key.id && this.botSentMessageIds.has(msg.key.id)) return;

    const userJid = this.sock?.user?.id;
    const userDigits = userJid ? userJid.replace(/[^0-9]/g, "") : "";
    const jidDigits = jid.replace(/[^0-9]/g, "");
    const pushName = msg.pushName || "";

    const { allowlistRecipient } = await import("./active-channel.js");
    if (userDigits) allowlistRecipient("WHATSAPP", userDigits);

    // 1. Self-chat: merchant texting themselves
    const isSelfChat = Boolean(
      (userDigits && jidDigits === userDigits) ||
      (msg.key.fromMe && (userDigits === "" || jidDigits === userDigits))
    );

    // 2. Atharva Chaskar: team member / collaborator for demo
    const atharvaEnvPhone = (process.env.ATHARVA_PHONE || process.env.ATHARVA_WHATSAPP || "").replace(/[^0-9]/g, "");
    const isAtharva = Boolean(
      /atharva|chaskar/i.test(pushName) ||
      (atharvaEnvPhone && jidDigits === atharvaEnvPhone) ||
      this.atharvaJids.has(jid) ||
      this.atharvaJids.has(jidDigits)
    );

    if (isAtharva) {
      this.atharvaJids.add(jid);
      this.atharvaJids.add(jidDigits);
      allowlistRecipient("WHATSAPP", jidDigits);
    }

    // 3. STRICT PRIVACY GUARD: DO NOT access any other personal/client/group chats
    if (!isSelfChat && !isAtharva) {
      return;
    }

    const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? "";
    if (!text.trim()) return;

    const receivedAt = new Date();
    const senderName = isSelfChat ? "Merchant (Owner)" : (pushName || "Atharva Chaskar");
    const role: IdentityRole = isSelfChat ? "OWNER" : "STAFF";

    const decisionMatch = /^(APPROVE|REJECT)\s+(\S+)/i.exec(text.trim());
    if (decisionMatch) {
      await this.onEvent({
        channel: "WHATSAPP",
        storeId: this.storeId,
        role,
        identityId: jid,
        externalId: jid,
        kind: "BUTTON",
        button: { decisionId: decisionMatch[2]!, action: decisionMatch[1]!.toUpperCase() as "APPROVE" | "REJECT" },
        receivedAt,
        senderName,
      });
      return;
    }

    await this.onEvent({
      channel: "WHATSAPP",
      storeId: this.storeId,
      role,
      identityId: jid,
      externalId: jid,
      kind: "TEXT",
      text,
      receivedAt,
      senderName,
    });
  }

  /** Accepts either a raw phone number ("919876543210") or an already-formed JID. */
  private jidFor(identityId: string): string {
    if (identityId.includes("@")) return identityId;
    const digits = identityId.replace(/[^0-9]/g, "");
    return `${digits}@s.whatsapp.net`;
  }

  private assertConnected(): WASocket {
    if (!this.sock || this.status !== "CONNECTED") {
      throw new Error("WhatsApp (Baileys) is not linked yet — scan the QR code first.");
    }
    return this.sock;
  }

  async sendText(msg: OutboundText): Promise<void> {
    const sock = this.assertConnected();
    const target = this.jidFor(msg.toIdentityId);
    const res = await sock.sendMessage(target, { text: msg.text });
    if (res?.key?.id) {
      this.botSentMessageIds.add(res.key.id);
      if (this.botSentMessageIds.size > 2000) {
        const first = this.botSentMessageIds.values().next().value;
        if (first) this.botSentMessageIds.delete(first);
      }
    }
  }

  async sendCard(card: OutboundCard): Promise<void> {
    const sock = this.assertConnected();
    const lines = [`${card.agentAvatar} *${card.agentName}*`, card.message];
    for (const b of card.buttons ?? []) {
      lines.push(`• Reply "${b.action} ${card.decisionId}" to *${b.label}*`);
    }
    const target = this.jidFor(card.toIdentityId);
    const res = await sock.sendMessage(target, { text: lines.join("\n") });
    if (res?.key?.id) {
      this.botSentMessageIds.add(res.key.id);
      if (this.botSentMessageIds.size > 2000) {
        const first = this.botSentMessageIds.values().next().value;
        if (first) this.botSentMessageIds.delete(first);
      }
    }
  }

  async sendVoiceNote(note: OutboundVoiceNote): Promise<void> {
    const sock = this.assertConnected();
    const target = this.jidFor(note.toIdentityId);
    const res = await sock.sendMessage(target, { text: `🔊 ${note.script}` });
    if (res?.key?.id) {
      this.botSentMessageIds.add(res.key.id);
      if (this.botSentMessageIds.size > 2000) {
        const first = this.botSentMessageIds.values().next().value;
        if (first) this.botSentMessageIds.delete(first);
      }
    }
  }
}
