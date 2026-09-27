import type { CortexDb } from "@cortex/db";
import type { IdentityRole } from "@cortex/shared";

export interface InboundTextContext {
  db: CortexDb;
  storeId: string;
  role: IdentityRole;
  identityId: string;
  text: string;
}

export interface InboundTextOutcome {
  handled: boolean;
  routedTo?: string;
}

export type InboundTextHandler = (ctx: InboundTextContext) => Promise<InboundTextOutcome>;

const handlers: InboundTextHandler[] = [];

/** Agents register intent handlers here (e.g. Aman's "check ₹350" lookup)
 * so the channel routes stay agent-agnostic. First handler to claim the
 * message wins. */
export function registerInboundTextHandler(handler: InboundTextHandler): void {
  handlers.push(handler);
}

export async function dispatchInboundText(ctx: InboundTextContext): Promise<InboundTextOutcome> {
  for (const handler of handlers) {
    const outcome = await handler(ctx);
    if (outcome.handled) return outcome;
  }
  return { handled: false };
}
