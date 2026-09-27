import type { ChannelAdapter, ChannelName, OutboundCard, OutboundText, OutboundVoiceNote } from "./adapter.js";

export type SimulatorOutboxEntry =
  | ({ kind: "TEXT" } & OutboundText)
  | ({ kind: "CARD" } & OutboundCard)
  | ({ kind: "VOICE" } & OutboundVoiceNote);

/**
 * In-app channel used whenever live WhatsApp/Telegram tokens are absent
 * (AGENTS.md invariant 5: "demo is offline-safe"). Every send is appended
 * to an inspectable outbox instead of hitting a real API — the desktop
 * mirror and verify-api.ts scenarios read from here.
 */
export class SimulatorChannel implements ChannelAdapter {
  readonly mode = "SIMULATOR" as const;
  private outbox = new Map<string, SimulatorOutboxEntry[]>();

  constructor(readonly channel: ChannelName) {}

  async sendText(msg: OutboundText): Promise<void> {
    this.push(msg.storeId, { kind: "TEXT", ...msg });
  }

  async sendCard(card: OutboundCard): Promise<void> {
    this.push(card.storeId, { kind: "CARD", ...card });
  }

  async sendVoiceNote(note: OutboundVoiceNote): Promise<void> {
    this.push(note.storeId, { kind: "VOICE", ...note });
  }

  private push(storeId: string, entry: SimulatorOutboxEntry): void {
    const list = this.outbox.get(storeId) ?? [];
    list.push(entry);
    this.outbox.set(storeId, list);
  }

  getOutbox(storeId: string): readonly SimulatorOutboxEntry[] {
    return this.outbox.get(storeId) ?? [];
  }

  reset(storeId: string): void {
    this.outbox.delete(storeId);
  }
}

export const simulatorWhatsapp = new SimulatorChannel("WHATSAPP");
export const simulatorTelegram = new SimulatorChannel("TELEGRAM");
