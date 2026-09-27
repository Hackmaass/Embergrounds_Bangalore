import type { ChannelAdapter, InboundEvent, OutboundCard, OutboundText, OutboundVoiceNote } from "./adapter.js";

const GRAPH_API_VERSION = "v21.0";

/**
 * Meta WhatsApp Cloud API adapter. Structurally complete against the
 * documented Cloud API request shapes, but **not exercised against a real
 * WhatsApp Business number** — no Meta app/token exists in this
 * environment. Falls back to SIMULATOR mode (packages/db/src/seed.ts)
 * whenever WHATSAPP_ACCESS_TOKEN is unset, so the demo is never blocked
 * on this being verified live.
 */
export class WhatsAppChannel implements ChannelAdapter {
  readonly channel = "WHATSAPP" as const;
  readonly mode = "LIVE" as const;

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  private async send(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp send failed: HTTP ${res.status} ${await res.text()}`);
    }
  }

  async sendText(msg: OutboundText): Promise<void> {
    await this.send({ to: msg.toIdentityId, type: "text", text: { body: msg.text } });
  }

  async sendCard(card: OutboundCard): Promise<void> {
    await this.send({
      to: card.toIdentityId,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: `${card.agentAvatar} ${card.agentName}: ${card.message}` },
        action: {
          buttons: (card.buttons ?? []).map((b) => ({
            type: "reply",
            reply: { id: `${card.decisionId}:${b.action}`, title: b.label },
          })),
        },
      },
    });
  }

  async sendVoiceNote(note: OutboundVoiceNote): Promise<void> {
    // Sending an actual .ogg/opus voice note requires the Media Upload
    // endpoint first; text delivery of the script is the honest fallback
    // until that upload step is wired to a real TTS render.
    await this.send({ to: note.toIdentityId, type: "text", text: { body: `🔊 ${note.script}` } });
  }
}

/** Meta webhook payload -> our normalized InboundEvent. Only the shapes
 * this product uses (text, button reply) are parsed. */
export function parseWhatsAppWebhook(body: unknown, storeId: string): InboundEvent | undefined {
  const entry = (body as Record<string, unknown>)?.entry as Array<Record<string, unknown>> | undefined;
  const change = entry?.[0]?.changes as Array<Record<string, unknown>> | undefined;
  const value = change?.[0]?.value as Record<string, unknown> | undefined;
  const message = (value?.messages as Array<Record<string, unknown>> | undefined)?.[0];
  if (!message) return undefined;

  const from = message.from as string;
  const receivedAt = new Date();

  if (message.type === "text") {
    const text = (message.text as { body?: string })?.body ?? "";
    return { channel: "WHATSAPP", storeId, role: "OWNER", identityId: from, externalId: from, kind: "TEXT", text, receivedAt };
  }
  if (message.type === "interactive") {
    const buttonReplyId = (message.interactive as { button_reply?: { id?: string } })?.button_reply?.id ?? "";
    const [decisionId, action] = buttonReplyId.split(":");
    if (decisionId && (action === "APPROVE" || action === "REJECT")) {
      return {
        channel: "WHATSAPP",
        storeId,
        role: "OWNER",
        identityId: from,
        externalId: from,
        kind: "BUTTON",
        button: { decisionId, action },
        receivedAt,
      };
    }
  }
  return undefined;
}
