import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessage,
  type proto,
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
  private bootTime = Date.now();

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
      console.log(`[whatsapp upsert] received ${messages.length} message(s) (type: ${type})`);
      for (const msg of messages) {
        void this.handleInbound(msg);
      }
    });
  }

  private cleanDigits(jid?: string): string {
    if (!jid) return "";
    return jid.split("@")[0]!.split(":")[0]!.replace(/[^0-9]/g, "");
  }

  private extractText(m?: proto.IMessage | null): string {
    if (!m) return "";
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.ephemeralMessage?.message) return this.extractText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return this.extractText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return this.extractText(m.viewOnceMessageV2.message);
    if (m.documentWithCaptionMessage?.message) return this.extractText(m.documentWithCaptionMessage.message);
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
    if (m.templateButtonReplyMessage?.selectedDisplayText) return m.templateButtonReplyMessage.selectedDisplayText;
    return "";
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
      const userPhone = this.cleanDigits(this.sock?.user?.id);
      const userLid = this.cleanDigits(this.sock?.user?.lid);
      if (userPhone) {
        const { allowlistRecipient, setLinkedOwner } = await import("./active-channel.js");
        allowlistRecipient("WHATSAPP", userPhone);
        if (userLid) allowlistRecipient("WHATSAPP", userLid);
        setLinkedOwner(userPhone);
      }
      console.log(`[whatsapp] Linked and connected as ${userPhone || "merchant"}.`);
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

    // Ignore messages sent by our bot script
    if (msg.key.id && this.botSentMessageIds.has(msg.key.id)) return;

    // Ignore historical messages replayed on connection before server boot
    let rawTime = msg.messageTimestamp;
    if (typeof rawTime === "object" && rawTime !== null && "low" in rawTime) {
      rawTime = (rawTime as { low: number }).low;
    }
    const msgTime = typeof rawTime === "number" ? rawTime * 1000 : 0;
    if (msgTime > 0 && msgTime < this.bootTime - 120_000) return;

    const userPhone = this.cleanDigits(this.sock?.user?.id);
    const userLid = this.cleanDigits(this.sock?.user?.lid);
    const jidClean = this.cleanDigits(jid);
    const pushName = msg.pushName || "";
    const fromMe = Boolean(msg.key.fromMe);

    // 1. Self-chat: merchant texting themselves
    const isSelfChat = Boolean(
      (userPhone && jidClean === userPhone) ||
      (userLid && jidClean === userLid) ||
      (fromMe && (jidClean === userPhone || jidClean === userLid || jid.endsWith("@lid") || !jid.includes("@")))
    );

    // 2. Atharva Chaskar: team member / collaborator for demo
    const atharvaEnvPhone = (process.env.ATHARVA_PHONE || process.env.ATHARVA_WHATSAPP || "").replace(/[^0-9]/g, "");
    const isAtharva = Boolean(
      /atharva|chaskar/i.test(pushName) ||
      (atharvaEnvPhone && jidClean === atharvaEnvPhone) ||
      this.atharvaJids.has(jid) ||
      this.atharvaJids.has(jidClean)
    );

    // 3. STRICT PRIVACY GUARD: DO NOT access any other personal/client/group chats
    if (!isSelfChat && !isAtharva) {
      return;
    }

    const { allowlistRecipient, setLinkedOwner } = await import("./active-channel.js");
    if (userPhone) {
      allowlistRecipient("WHATSAPP", userPhone);
      setLinkedOwner(userPhone);
    }
    if (userLid) allowlistRecipient("WHATSAPP", userLid);
    if (jidClean) allowlistRecipient("WHATSAPP", jidClean);
    allowlistRecipient("WHATSAPP", jid);

    if (isAtharva) {
      this.atharvaJids.add(jid);
      if (jidClean) {
        this.atharvaJids.add(jidClean);
      }
    }

    const text = this.extractText(msg.message);
    if (!text.trim()) return;

    // For self-chat, deliver replies to the user's phone JID so WhatsApp renders it in the self-chat
    const targetIdentityId = isSelfChat && userPhone ? `${userPhone}@s.whatsapp.net` : jid;
    const senderName = isSelfChat ? "Merchant (Owner)" : (pushName || "Atharva Chaskar");
    console.log(`[whatsapp inbound] Accepted message from ${senderName} (${jid} -> target: ${targetIdentityId}): "${text.trim()}"`);

    const receivedAt = new Date();
    const role: IdentityRole = isSelfChat ? "OWNER" : "STAFF";

    const decisionMatch = /^(APPROVE|REJECT)\s+(\S+)/i.exec(text.trim());
    if (decisionMatch) {
      await this.onEvent({
        channel: "WHATSAPP",
        storeId: this.storeId,
        role,
        identityId: targetIdentityId,
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
      identityId: targetIdentityId,
      externalId: jid,
      kind: "TEXT",
      text,
      receivedAt,
      senderName,
    });
  }

  /** Accepts either a raw phone number ("919876543210") or an already-formed JID. */
  private jidFor(identityId: string): string {
    const userPhone = this.cleanDigits(this.sock?.user?.id);
    if (identityId === "owner" && userPhone) {
      return `${userPhone}@s.whatsapp.net`;
    }
    if (identityId.includes("@")) {
      const userLid = this.cleanDigits(this.sock?.user?.lid);
      if (identityId.endsWith("@lid") && userLid && this.cleanDigits(identityId) === userLid && userPhone) {
        return `${userPhone}@s.whatsapp.net`;
      }
      return identityId;
    }
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
    console.log(`[whatsapp send] Sending message to ${target}: "${msg.text.slice(0, 80).replace(/\n/g, " ")}..."`);
    const res = await sock.sendMessage(target, { text: msg.text });
    console.log(`[whatsapp send] Successfully sent to ${target}, id: ${res?.key?.id}`);
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
    console.log(`[whatsapp sendCard] Sending card to ${target}: ${card.agentName}`);
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
    console.log(`[whatsapp sendVoiceNote] Sending note to ${target}`);
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

