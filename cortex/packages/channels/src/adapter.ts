import type { DecisionButton, DecisionKind, IdentityRole } from "@cortex/shared";

export type ChannelName = "WHATSAPP" | "TELEGRAM";

export interface InboundEvent {
  channel: ChannelName;
  storeId: string;
  role: IdentityRole;
  identityId: string;
  externalId: string;
  kind: "TEXT" | "VOICE" | "BUTTON";
  text?: string;
  button?: { decisionId: string; action: "APPROVE" | "REJECT" };
  receivedAt: Date;
  senderName?: string;
}

export interface OutboundCard {
  storeId: string;
  toIdentityId: string;
  agentName: string;
  agentAvatar: string;
  message: string;
  decisionId?: string;
  decisionKind?: DecisionKind;
  buttons?: DecisionButton[];
}

export interface OutboundText {
  storeId: string;
  toIdentityId: string;
  text: string;
}

export interface OutboundVoiceNote {
  storeId: string;
  toIdentityId: string;
  /** Hindi/Hinglish script the VoiceProvider would speak (AGENTS.md §3.3). */
  script: string;
}

/**
 * One contract every channel implements: normalize inbound (text, voice,
 * button reply) into a common event; send outbound text, interactive
 * decision cards and voice notes. WhatsApp/Telegram/Simulator are all
 * ChannelAdapters — routes and agents never branch on which one is active.
 */
export interface ChannelAdapter {
  readonly channel: ChannelName;
  readonly mode: "LIVE" | "SIMULATOR";
  sendText(msg: OutboundText): Promise<void>;
  sendCard(card: OutboundCard): Promise<void>;
  sendVoiceNote(note: OutboundVoiceNote): Promise<void>;
}
