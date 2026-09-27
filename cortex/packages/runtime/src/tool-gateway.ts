import type { StudioTool } from "@cortex/shared";

/** "+919812345678" -> "+91 98xxxxxx78" — the masking style used throughout
 * the product spec's own khata mock data. */
export function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const countryAndPrefix = digits.slice(0, digits.length - 8); // e.g. "91"
  const first2 = digits.slice(-10, -8);
  const last2 = digits.slice(-2);
  return `+${countryAndPrefix} ${first2}xxxxxx${last2}`;
}

export class ToolNotAllowedError extends Error {
  constructor(tool: string, agentId: string) {
    super(`Tool "${tool}" is not in agent "${agentId}"'s sandboxed catalogue`);
    this.name = "ToolNotAllowedError";
  }
}

/** Core agents (Priya/Aman/Vikram/Munim/Meera) may call any internal tool;
 * Studio-compiled custom agents are restricted to their granted `tools[]`. */
export function assertToolAllowed(args: {
  agentId: string;
  isCustom: boolean;
  grantedTools: StudioTool[];
  tool: StudioTool;
}): void {
  if (!args.isCustom) return;
  if (!args.grantedTools.includes(args.tool)) {
    throw new ToolNotAllowedError(args.tool, args.agentId);
  }
}

export interface ToolCallAudit {
  agentId: string;
  tool: string;
  argsRedacted: Record<string, unknown>;
  calledAt: Date;
}

const auditLog: ToolCallAudit[] = [];

/** Every tool call funnels through here so callers get one audit trail,
 * independent of which specific tool (WhatsApp send, UPI link, RFQ) it is. */
export function auditToolCall(agentId: string, tool: string, args: Record<string, unknown>): void {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    redacted[key] = typeof value === "string" && /phone|mobile/i.test(key) ? redactPhone(value) : value;
  }
  auditLog.push({ agentId, tool, argsRedacted: redacted, calledAt: new Date() });
}

export function getToolAuditLog(): readonly ToolCallAudit[] {
  return auditLog;
}
