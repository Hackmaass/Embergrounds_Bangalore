import { z } from "zod";

function zenum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

// AGENTS.md §5.2 — activity stream event `type`
export const EVENT_TYPES = [
  "ANOMALY_DETECTED",
  "ROOT_CAUSE_ISOLATED",
  "COHORT_BUILT",
  "GUARDRAIL_PASSED",
  "GUARDRAIL_BLOCKED",
  "DECISION_STAGED",
  "DECISION_APPROVED",
  "DECISION_REJECTED",
  "ACTION_EXECUTED",
  "SOUNDBOX_ANNOUNCED",
  "DISPUTE_OPENED",
  "PAYMENT_VERIFIED",
  "RECONCILIATION_MISMATCH",
  "COMPLIANCE_DUE",
  "ATTENDANCE_SUMMARY",
  "AGENT_HIRED",
] as const;
export const EventTypeEnum = zenum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeEnum>;

// AGENTS.md §5.2 — activity stream event `severity`
export const SEVERITIES = ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const;
export const SeverityEnum = zenum(SEVERITIES);
export type Severity = z.infer<typeof SeverityEnum>;

// AGENTS.md §5.3 — decision contract kinds
export const DECISION_KINDS = [
  "VOUCHER_CAMPAIGN",
  "PURCHASE_ORDER",
  "PAYROLL_PAYOUT",
  "KHATA_REMINDER_BATCH",
] as const;
export const DecisionKindEnum = zenum(DECISION_KINDS);
export type DecisionKind = z.infer<typeof DecisionKindEnum>;

// AGENTS.md §5.3 — decision action `source`
export const ACTION_SOURCES = ["WHATSAPP", "TELEGRAM", "DESKTOP"] as const;
export const ActionSourceEnum = zenum(ACTION_SOURCES);
export type ActionSource = z.infer<typeof ActionSourceEnum>;

// Decision lifecycle status (drives PO/khata/payroll status pills too)
export const DECISION_STATUSES = [
  "AWAITING_APPROVAL",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
  "BLOCKED",
] as const;
export const DecisionStatusEnum = zenum(DECISION_STATUSES);
export type DecisionStatus = z.infer<typeof DecisionStatusEnum>;

// AGENTS.md §5.1 — channel connectivity
export const CHANNEL_STATUSES = ["CONNECTED", "SIMULATOR", "DISCONNECTED"] as const;
export const ChannelStatusEnum = zenum(CHANNEL_STATUSES);
export type ChannelStatus = z.infer<typeof ChannelStatusEnum>;

export const SOUNDBOX_STATUSES = ["ONLINE", "OFFLINE", "SIMULATOR"] as const;
export const SoundboxStatusEnum = zenum(SOUNDBOX_STATUSES);
export type SoundboxStatus = z.infer<typeof SoundboxStatusEnum>;

// AGENTS.md §5.1 roster statuses + custom-agent lifecycle (§5.4)
export const AGENT_STATUSES = [
  "MONITORING",
  "READY",
  "PO_PENDING",
  "RECONCILED",
  "ACTIVE",
  "DRAFT",
  "HIRED",
  "PAUSED",
] as const;
export const AgentStatusEnum = zenum(AGENT_STATUSES);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

// FRONTEND_SPEC §4.1 — khata ledger row status
export const KHATA_ENTRY_STATUSES = ["REMINDER_DRAFTED", "REMINDED", "PAID"] as const;
export const KhataEntryStatusEnum = zenum(KHATA_ENTRY_STATUSES);
export type KhataEntryStatus = z.infer<typeof KhataEntryStatusEnum>;

// AGENTS.md §5.6 — manual khata ledger entry type
export const KHATA_TXN_TYPES = ["CREDIT", "PAYMENT"] as const;
export const KhataTxnTypeEnum = zenum(KHATA_TXN_TYPES);
export type KhataTxnType = z.infer<typeof KhataTxnTypeEnum>;

// AGENTS.md §5.8 — compliance calendar item status
export const COMPLIANCE_STATUSES = ["DRAFT_READY", "UPCOMING", "OVERDUE", "FILED"] as const;
export const ComplianceStatusEnum = zenum(COMPLIANCE_STATUSES);
export type ComplianceStatus = z.infer<typeof ComplianceStatusEnum>;

// AGENTS.md §5.10 — worker attendance status
export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"] as const;
export const AttendanceStatusEnum = zenum(ATTENDANCE_STATUSES);
export type AttendanceStatusT = z.infer<typeof AttendanceStatusEnum>;

// AGENTS.md §5.10 — attendance POST type
export const ATTENDANCE_ACTIONS = ["CHECK_IN", "CHECK_OUT"] as const;
export const AttendanceActionEnum = zenum(ATTENDANCE_ACTIONS);
export type AttendanceAction = z.infer<typeof AttendanceActionEnum>;

// AGENTS.md §5.3 — generic decision action
export const DECISION_ACTIONS = ["APPROVE", "REJECT"] as const;
export const DecisionActionEnum = zenum(DECISION_ACTIONS);
export type DecisionActionValue = z.infer<typeof DecisionActionEnum>;

// Channel identity roles (AGENTS.md §3.2 channel gateway)
export const IDENTITY_ROLES = ["OWNER", "STAFF", "SUPPLIER", "CUSTOMER"] as const;
export const IdentityRoleEnum = zenum(IDENTITY_ROLES);
export type IdentityRole = z.infer<typeof IdentityRoleEnum>;
