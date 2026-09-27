import type { ChannelAdapter, InboundEvent, OutboundCard, OutboundText, OutboundVoiceNote } from "./adapter.js";

/**
 * Telegram Bot API adapter — long-polling (`getUpdates`), matching
 * AGENTS.md §7.1: "needs no public IP, port-forwarding or tunnel; works
 * on a presenter's phone hotspot." Structurally complete against the Bot
 * API, but **not exercised against a real bot token** — none exists in
 * this environment. Falls back to SIMULATOR mode when TELEGRAM_BOT_TOKEN
 * is unset.
 */
export class TelegramChannel implements ChannelAdapter {
  readonly channel = "TELEGRAM" as const;
  readonly mode = "LIVE" as const;

  constructor(private readonly botToken: string) {}

  private api(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  async sendText(msg: OutboundText): Promise<void> {
    await this.call("sendMessage", { chat_id: msg.toIdentityId, text: msg.text });
  }

  async sendCard(card: OutboundCard): Promise<void> {
    await this.call("sendMessage", {
      chat_id: card.toIdentityId,
      text: `${card.agentAvatar} ${card.agentName}: ${card.message}`,
      reply_markup: {
        inline_keyboard: [(card.buttons ?? []).map((b) => ({ text: b.label, callback_data: `${card.decisionId}:${b.action}` }))],
      },
    });
  }

  async sendVoiceNote(note: OutboundVoiceNote): Promise<void> {
    await this.call("sendMessage", { chat_id: note.toIdentityId, text: `🔊 ${note.script}` });
  }

  private async call(method: string, body: Record<string, unknown>): Promise<void> {
    const res = await fetch(this.api(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Telegram ${method} failed: HTTP ${res.status} ${await res.text()}`);
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; message?: { chat: { id: number } }; data?: string };
}

/**
 * Minimal long-poll loop. The caller supplies `onEvent` to route inbound
 * text/button events into the channel-agnostic pipeline (same one the
 * simulator and WhatsApp webhook use) — kept out of this package so
 * `@cortex/channels` doesn't need to depend on `@cortex/runtime`.
 */
export async function pollTelegramUpdates(
  botToken: string,
  storeId: string,
  onEvent: (event: InboundEvent) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let offset = 0;
  while (!signal.aborted) {
    let updates: TelegramUpdate[] = [];
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?timeout=25&offset=${offset}`, { signal });
      const json = (await res.json()) as { result?: TelegramUpdate[] };
      updates = json.result ?? [];
    } catch (err) {
      if (signal.aborted) return;
      console.error("[telegram] poll failed, retrying in 5s:", err);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      const receivedAt = new Date();

      if (update.message?.text) {
        const chatId = String(update.message.chat.id);
        await onEvent({ channel: "TELEGRAM", storeId, role: "OWNER", identityId: chatId, externalId: chatId, kind: "TEXT", text: update.message.text, receivedAt });
      } else if (update.callback_query?.data) {
        const [decisionId, action] = update.callback_query.data.split(":");
        const chatId = String(update.callback_query.message?.chat.id ?? "");
        if (decisionId && (action === "APPROVE" || action === "REJECT") && chatId) {
          await onEvent({ channel: "TELEGRAM", storeId, role: "OWNER", identityId: chatId, externalId: chatId, kind: "BUTTON", button: { decisionId, action }, receivedAt });
        }
      }
    }
  }
}
