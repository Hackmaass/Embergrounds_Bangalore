import type { StudioTemplate, StudioTool } from "@cortex/shared";

export interface TemplateBlueprint extends StudioTemplate {
  role: string;
  trigger: string;
  tools: StudioTool[];
  maxMessagesPerDay: number;
}

// PAYTM_WORKFORCE_STUDIO_PROPOSAL.md §4 — the four Studio starter templates.
export const STUDIO_TEMPLATES: TemplateBlueprint[] = [
  {
    template_id: "pharmacy-expiry-sentinel",
    name: "Pharmacy Expiry Sentinel",
    avatar: "💊",
    role: "Batch Shelf-Life Auditor",
    description: "Batch expiries, supplier credit claims, clearance flags.",
    prompt: "Track batch expiry dates. If a batch is within 30 days of expiry, flag it for a supplier credit claim or a clearance discount.",
    trigger: "CRON_HEARTBEAT_DAILY_09AM",
    tools: ["POS_STOCK_READ", "WHATSAPP_DRAFT"],
    maxMessagesPerDay: 20,
  },
  {
    template_id: "rush-hour-reconciler",
    name: "Rush-Hour Reconciler",
    avatar: "🍽️",
    role: "Delivery Commission Auditor",
    description: "Delivery commissions vs walk-in sales at peak.",
    trigger: "CRON_HEARTBEAT_DAILY_2200",
    prompt: "Compare delivery-platform commission deductions against walk-in POS sales during peak hours and flag mismatches.",
    tools: ["POS_STOCK_READ"],
    maxMessagesPerDay: 20,
  },
  {
    template_id: "apparel-slow-mover",
    name: "Apparel Slow-Mover Liquidation",
    avatar: "👗",
    role: "Slow-Mover Liquidator",
    description: "SKUs unsold for 21 days → weekend bundle offers.",
    trigger: "CRON_HEARTBEAT_WEEKLY_FRI_1800",
    prompt: "Find SKUs unsold for 21+ days and draft a weekend bundle discount offer for regular customers.",
    tools: ["POS_STOCK_READ", "WHATSAPP_DRAFT"],
    maxMessagesPerDay: 50,
  },
  {
    template_id: "udhaar-recovery-agent",
    name: "Udhaar Recovery Agent",
    avatar: "🧾",
    role: "Wholesale Credit Guardian",
    description: "Wholesale khata dues over ₹5,000 for 15+ days → polite WhatsApp reminder with a UPI link.",
    trigger: "CRON_HEARTBEAT_DAILY_11AM",
    prompt: "Track customer credit dues (khata). If balance exceeds ₹5,000 for more than 15 days, send a WhatsApp reminder with a Paytm UPI link.",
    tools: ["KHATA_READ", "WHATSAPP_DRAFT", "PAYTM_UPI_LINK_GENERATOR"],
    maxMessagesPerDay: 50,
  },
];

export function findTemplate(templateId: string | null): TemplateBlueprint | undefined {
  return STUDIO_TEMPLATES.find((t) => t.template_id === templateId);
}
