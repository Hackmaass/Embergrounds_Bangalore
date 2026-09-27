# AGENTS.md — Cortex ("The AI Back-Office for Bharat MSMEs")

> **Operational manual for AI & human contributors building Cortex — a standalone autonomous-workforce platform for Indian MSMEs and their workers.**
> Optimized for **Claude Opus** (Architecture, Planning & Review) and **Claude Sonnet** (High-Velocity Code Building).

---

## 1. System Vision & Hackathon Alignment

### Problem Statement — Track 3: Bharat Business (AI for MSMEs & Workers)
> *"Build AI that helps India's businesses and workforce do more with less."*
> Ideas: AI employees, WhatsApp business agents, accounting, sales, procurement, customer support, operations, and compliance.

### Positioning
**Cortex is an AI back-office for every Bharat MSME, run from WhatsApp.** A counter laptop (or a small cloud VM) runs a hired team of AI employees. The owner, their staff, suppliers and customers interact only through **WhatsApp / Telegram** and the **Paytm Soundbox** — zero new apps to install. "Do more with less" is measured in **₹ recovered, hours saved, and compliance deadlines never missed.**

### The AI Workforce (Product Roster)

| Agent ID | Agent | Brief Area(s) | Hero Workflow |
| :--- | :--- | :--- | :--- |
| `priya-sales` | 🎯 **Priya** — Sales & Win-back | Sales | 07:00 dip scan → stockout root cause → 10% win-back voucher to 28 regulars → 1-tap approve → revenue attribution |
| `aman-support` | 🛡️ **Aman** — Customer Support & UPI Disputes | Customer support | "Check ₹350" voice note → PG reconcile → Soundbox override *or* dispute ticket + WhatsApp slip to customer |
| `vikram-procurement` | 📦 **Vikram** — Stock & Procurement | Operations, Procurement | Low-stock forecast → WhatsApp quotes from 3 suppliers → draft PO → 1-tap approve → PO sent to supplier |
| `munim-accounts` | 📒 **Munim** — Accounts, Khata & GST | Accounting, Compliance | Settlement ↔ sales reconciliation, udhaar reminders with UPI links, GSTR-1 draft, compliance calendar (GST / FSSAI / shop licence) |
| `meera-staff` | 👷 **Meera** — Staff & Payroll Desk | Workers, Operations | WhatsApp "haazir" check-in, shift reminders, salary & advance ledger, payday UPI payout (1-tap), Hindi voice payslip |
| `custom-*` | ✨ **Studio Agents** | Anything else | Prompt / template → compiled, sandboxed agent (Expiry Sentinel, Rush-Hour Reconciler, Slow-Mover) |

### Core Invariants
1. **Standalone product.** Cortex is its own codebase (`cortex/`). The `paperclip/` repo is a **read-only reference architecture** — we study its patterns and re-implement them. **Never import from, fork into, or install into Paperclip.**
2. **Store-scoped architecture.** Every entity, query, route and log is scoped by `storeId` (Cortex's equivalent of Paperclip's `companyId`).
3. **Deterministic financial guardrails.** No money moves — voucher, discount, purchase order, payout — without a **signed decision contract** and a **merchant 1-tap approval**, unless a guardrail policy explicitly auto-approves below a threshold. Money math never goes through the LLM.
4. **Everything is audited.** Every mutation appends an activity event (which also feeds the live stream).
5. **Demo is offline-safe.** Every channel falls back to a simulator when tokens are absent; `POST /api/demo/reset` restores the seed state.

---

## 2. Multi-Agent Dev Hierarchy & Token Optimization Protocol

Development is divided across **3 Core Agents + 1 On-Demand Verifier**:

```
                          ┌─────────────────────────────────────────┐
                          │         architect-opus (Opus)           │
                          │   Planner, Suggester & Review Gate      │
                          │  • Milestone DAG breakdown              │
                          │  • DB schema & zod contract definitions │
                          │  • Guardrail & invariant auditing       │
                          └────────────────────┬────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
         ┌───────────────────────────┐                   ┌───────────────────────────┐
         │ backend-core-sonnet       │                   │ gateway-integrations      │
         │ (Claude Sonnet)           │                   │ (Claude Sonnet)           │
         │ Control Plane & Agents    │                   │ Channels, Voice & Mocks   │
         │ • Runtime primitives      │                   │ • WhatsApp Cloud API      │
         │ • Priya / Aman / Vikram   │                   │ • Telegram long-polling   │
         │ • Munim / Meera           │                   │ • Soundbox audio dispatch │
         │ • Studio compiler         │                   │ • VoiceProvider (STT/TTS) │
         │ • Guardrails & DB         │                   │ • PG / POS / supplier mock│
         └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                       └───────────────────────┬───────────────────────┘
                                               ▼
                                 ┌───────────────────────────┐
                                 │ verifier-sonnet           │
                                 │ Automated QA & Contracts  │
                                 │ • API contract runner     │
                                 │ • Workflow scenario runs  │
                                 │ • Typecheck assurance     │
                                 └───────────────────────────┘
```

### Agent Roles & Read Boundaries

| Agent ID | Model | Core Mandate | Read Boundary (Context Isolation) |
| :--- | :--- | :--- | :--- |
| `architect-opus` | **Claude Opus** | System design, schema & contract design, task DAGs, diff review. | Root docs (`AGENTS.md`, `PAYTM_WORKFORCE_STUDIO_PROPOSAL.md`, `FRONTEND_SPEC.md`), `cortex/packages/db/src/schema/*`, `cortex/packages/shared/*`, PR diffs. May cite `paperclip/**` as reference. |
| `backend-core-sonnet` | **Claude Sonnet** | Runtime primitives, agent workflows, guardrails, Drizzle queries, REST routes, Studio compiler. | `cortex/packages/{db,shared,runtime,agents,connectors}/*`, `cortex/apps/server/src/routes/*`. *(Forbidden: `cortex/apps/web/`)* |
| `gateway-integrations-sonnet` | **Claude Sonnet** | WhatsApp webhook & sender, Telegram polling, Soundbox audio, VoiceProvider, PG/POS/supplier mocks, simulator. | `cortex/packages/channels/*`, `cortex/packages/connectors/*`, `cortex/apps/server/src/routes/channels*.ts`. |
| `verifier-sonnet` | **Claude Sonnet** | Ephemeral runner: API contract checks, scenario runs, typecheck. | `cortex/scripts/*`, API outputs, root docs §5 contracts. |

### Paperclip Reference Rule
- `paperclip/**` is **read-only**. Nobody edits it.
- Builders may read **only the specific reference files** listed in §3.2, and only by targeted line ranges.
- Never copy-paste large blocks; re-implement the pattern in Cortex's simpler, retail-specific shape.

### Strict Token Minimization Directives
1. **No Monolithic Dumps**: Never read entire directories or 1,000+ line files when editing a function. Use targeted line-range reads.
2. **Context Isolation**: Backend builders never load `cortex/apps/web/`; nobody loads unrelated Paperclip adapters (`chat-slack*`, `chat-teams-*`, `chat-discord*`, `chat-github*`).
3. **Diff-Only Edits**: Use targeted replacements. Never rewrite entire files.
4. **Opus Invocation Frequency**: Opus runs **once** per milestone to author the spec and **once** to review the diff. Opus never writes boilerplate.
5. **No Speculative Polling**: Stop tool execution when awaiting a command or background task.

---

## 3. Architecture & Implementation Roadmap

### 3.1 Monorepo Layout (`D:\Projects\PaytmHackathon\cortex\`)

pnpm workspaces + TypeScript, mirroring Paperclip's proven layout (server / ui / db / shared):

```
cortex/
├── apps/
│   ├── server/                    # @cortex/server — Express API (port 3200), SSE, webhooks, scheduler boot
│   │   └── src/routes/            # cortex.routes.ts, channels.routes.ts, demo.routes.ts
│   └── web/                       # @cortex/web — React + Vite desktop Command Center
├── packages/
│   ├── db/                        # @cortex/db — Drizzle schema + migrations; PGlite embedded (zero-install)
│   │   └── src/schema/            # stores, agents, routines, tasks, decisions, activity, cost_events,
│   │                              # channel_bindings, sales, customers, inventory, suppliers, purchase_orders,
│   │                              # khata, settlements, compliance_items, staff, attendance, payroll
│   ├── shared/                    # @cortex/shared — zod contracts, API types, constants (FE/BE single source)
│   ├── runtime/                   # @cortex/runtime — the control plane (see 3.2)
│   │   └── src/                   # scheduler, agent-registry, task-dag, decisions, guardrails,
│   │                              # tool-gateway, cost-ledger, activity, event-bus, llm
│   ├── agents/                    # @cortex/agents — priya/, aman/, vikram/, munim/, meera/, studio-compiler/
│   ├── channels/                  # @cortex/channels — whatsapp/, telegram/, soundbox/, simulator/, voice/
│   └── connectors/                # @cortex/connectors — paytm-pg-mock, pos-mock, supplier-mock, gst-export
└── scripts/                       # seed-demo.ts, verify-api.ts, demo-reset.ts
```

### 3.2 Control-Plane Primitives (`@cortex/runtime`) & Paperclip References

| Cortex Primitive | What It Does | Paperclip Reference (read-only) |
| :--- | :--- | :--- |
| **Store scoping** | Every row/query scoped by `storeId`; enforced in routes & services | `packages/db/src/schema/companies.ts`, `paperclip/AGENTS.md` §5.1 |
| **Agent registry** | Roster, role, capabilities, budget, status, `is_custom` | `packages/db/src/schema/agents.ts` |
| **Scheduler / heartbeat** | Cron routines (07:00 sales scan, 11:00 khata, payday); coalesce-if-active; skip-missed | `server/src/services/routines.ts`, `cron.ts`, `heartbeat.ts`; `schema/routines.ts` |
| **Task DAG** | Parent/child tasks per workflow run; drives the live stream | `schema/issues.ts`, `schema/issue_relations.ts` |
| **Decision contracts** | Immutable HMAC-signed spec, options, expiry, idempotency key, execution status | `schema/decisions.ts`, `services/decision-signing.ts`, `services/decisions.ts` |
| **Guardrails engine** | Pure-function checks: margin floor, discount cap, daily message & spend caps, quiet hours, payout ceiling | `services/budgets.ts`, `schema/budget_policies.ts` |
| **Tool gateway** | Capability-gated tool calls, PII redaction, audit of every call | `services/tool-gateway.ts` |
| **Cost ledger** | LLM tokens + WhatsApp message cost per agent; hard-stop auto-pause | `services/costs.ts`, `schema/cost_events.ts` |
| **Activity log / event bus** | Append-only events → SSE `/stream/live` | `schema/heartbeat_run_events.ts`, `appendRunEvent` in `heartbeat.ts` |
| **Channel gateway** | Normalize inbound (text / voice / button), send outbound cards, bind identities (owner / staff / supplier / customer) | `services/chat-channels.ts`, `chat-channel-binding.ts`, `chat-telegram-*.ts` |

### 3.3 AI Layer
- **Claude via Anthropic SDK.** `claude-haiku-4-5` for intent routing & classification of inbound messages; `claude-sonnet-5` for agent reasoning, message drafting and the Studio compiler.
- **Deterministic core.** All ₹ math, margins, caps and payouts are pure TypeScript functions in `runtime/guardrails` — the LLM proposes, the guardrail decides.
- **Voice.** Hindi/Hinglish STT & TTS behind a `VoiceProvider` interface (pluggable Indic provider; OS TTS as offline fallback).

### 3.4 Build Order (Priority DAG)

#### P0 — Platform Kernel
`@cortex/db` schema + PGlite, `@cortex/shared` contracts, runtime primitives (scheduler, decisions, guardrails, activity/event bus, cost ledger), SSE stream, simulator channel, `seed-demo.ts`, `POST /api/demo/reset`.

#### P1 — Priya: Autonomous Sales Recovery
1. **Trigger**: 07:00 routine.
2. **Detect**: yesterday's hourly sales vs 30-day baseline → 6–9 PM dip (-38%, ₹4,800 deficit).
3. **Root cause**: calls Vikram's stock log → "Butter Paneer" out-of-stock at 5:45 PM; 28 regulars affected.
4. **Guardrail**: gross margin 45% − 10% discount = 35% net ≥ floor → PASSED; WhatsApp spend ₹140 ≤ daily cap.
5. **Decision**: `VOUCHER_CAMPAIGN` contract with unique coupon IDs.
6. **Dispatch**: 1-tap card to owner `[✅ Approve & Send] / [❌ Reject]`.
7. **Outcome**: vouchers sent, Soundbox confirmation, redemptions attributed over 48 h.

#### P2 — Aman: Customer Support & UPI Disputes
1. **Trigger**: owner voice/text "Check last payment ₹350".
2. **Reconcile**: PG mock → txns of ₹350 in last 5 min + Soundbox queue telemetry.
3. **Case SUCCESS + Soundbox lag**: edge override → "Paytm par teen sau pachaas rupaye prapt huye".
4. **Case PENDING**: dispute ticket `#PTM-44` + reassuring WhatsApp slip to customer.
5. **Outcome**: resolution time (target < 5 s) and disputes auto-cleared.

#### P3 — Live Gateways
WhatsApp Cloud API (webhook + interactive buttons), Telegram long-polling (inline keyboards), Soundbox audio, VoiceProvider. Simulator stays as fallback.

#### P4 — Munim: Accounts, Khata & GST
1. **Triggers**: 21:00 daily close; 11:00 khata routine; compliance calendar daily check.
2. **Reconcile**: PG settlements vs POS sales → flag mismatches (e.g. ₹620 short settlement).
3. **Khata**: customers with udhaar > ₹5,000 for > 15 days → `KHATA_REMINDER_BATCH` decision (polite Hindi reminders + UPI payment links; quiet hours 20:00–10:00).
4. **GST**: monthly GSTR-1 draft (JSON/CSV export) from UPI + POS data; owner reviews, CA files.
5. **Compliance**: GST / FSSAI / shop-licence due dates → reminders at T-7 and T-1 days.
6. **Outcome**: udhaar recovered ₹, mismatches caught, deadlines met.

#### P5 — Vikram: Stock & Procurement
1. **Trigger**: 18:00 stock routine + POS low-stock events.
2. **Forecast**: 7-day velocity → reorder qty for SKUs below cover (e.g. Paneer 12 kg).
3. **Quotes**: WhatsApp RFQ to 3 bound suppliers; parse replies (LLM) into structured quotes.
4. **Guardrail**: PO total ≤ procurement cap; price ≤ last-price + 8%.
5. **Decision**: `PURCHASE_ORDER` contract → owner 1-tap → PO sent to chosen supplier.
6. **Outcome**: stockouts avoided, ₹ saved vs last price.

#### P6 — Meera: Staff & Payroll Desk
1. **Triggers**: staff WhatsApp "haazir" check-in; shift reminder routine; payday routine.
2. **Attendance**: check-in/out ledger per worker; late/absent summary to owner.
3. **Ledger**: salary, advances, deductions per worker.
4. **Guardrail**: payout ≤ computed net pay; total ≤ payroll cap.
5. **Decision**: `PAYROLL_PAYOUT` contract → owner 1-tap → UPI payout (mock) to each worker.
6. **Outcome**: Hindi voice payslip to each worker; owner hours saved; workers get on-time pay + transparent record.

#### P7 — Studio Compiler
1. Accepts a natural-language prompt or a template (Pharmacy Expiry Sentinel, Rush-Hour Reconciler, Apparel Slow-Mover, Udhaar Recovery).
2. Compiles to a structured, validated (zod) spec: routine schedule, sandboxed tools (`WHATSAPP_DRAFT`, `PAYTM_UPI_LINK_GENERATOR`, …), guardrails (`max_messages_per_day`, `restricted_hours`, `require_merchant_approval: true`).
3. Persists as an agent with `is_custom: true`; scheduler picks it up immediately.

---

## 4. Frontend UI Summary

Full detail lives in `FRONTEND_SPEC.md`. The desktop app (`@cortex/web`) has a **left nav rail** with six views:

| View | Purpose |
| :--- | :--- |
| **Command Center** | Sections A–E: Store Header, Workforce Roster (5 core + custom), Live Task Stream (60%), Remote Control Mirror (40%), Outcomes Bar |
| **Khata & Accounts** | Udhaar ledger, settlement reconciliation, GSTR-1 draft, compliance calendar |
| **Stock & Purchase** | Low-stock SKUs, supplier quotes comparison, purchase orders |
| **Staff** | Today's attendance, worker ledger, payday payout |
| **Studio** | Templates + prompt-to-agent compiler + hire |
| **Channels** | QR onboarding and live status for WhatsApp / Telegram / Soundbox |

Palette: Paytm Dark Navy `#002970`, Paytm Sky Blue `#00BAF2`, WhatsApp `#075E54` / `#25D366`, Card White `#FFFFFF` with `#E2E8F0` borders.

---

## 5. API Contracts & Mock Fixtures

Base URL: `http://localhost:3200`. All `/api/cortex/*` routes are scoped to the active store (single-store demo: `store-ramesh`).

### 5.1 `GET /api/cortex/workforce`
```json
{
  "store": {
    "id": "store-ramesh",
    "name": "Ramesh Sweets & Restaurant",
    "gstin": "07AAAAA0000A1Z5",
    "soundbox": { "status": "ONLINE", "battery": 88, "edge_override": true },
    "channels": { "whatsapp": "CONNECTED", "telegram": "CONNECTED" }
  },
  "agents": [
    { "id": "priya-sales", "name": "Priya", "role": "Sales & Win-back", "avatar": "🎯", "status": "MONITORING", "metric_label": "Recovered Revenue", "metric_value": "₹14,800 (Wk)", "is_custom": false },
    { "id": "aman-support", "name": "Aman", "role": "Customer Support & UPI Disputes", "avatar": "🛡️", "status": "READY", "metric_label": "Disputes Resolved", "metric_value": "18 UPI Holds", "is_custom": false },
    { "id": "vikram-procurement", "name": "Vikram", "role": "Stock & Procurement", "avatar": "📦", "status": "PO_PENDING", "metric_label": "Low Stock SKUs", "metric_value": "2 SKUs", "is_custom": false },
    { "id": "munim-accounts", "name": "Munim", "role": "Accounts, Khata & GST", "avatar": "📒", "status": "RECONCILED", "metric_label": "Udhaar Recovered", "metric_value": "₹9,200 (Mo)", "is_custom": false },
    { "id": "meera-staff", "name": "Meera", "role": "Staff & Payroll Desk", "avatar": "👷", "status": "ACTIVE", "metric_label": "Present Today", "metric_value": "5 / 6 Staff", "is_custom": false },
    { "id": "custom-expiry", "name": "Expiry Sentinel", "role": "Batch Shelf-Life Auditor", "avatar": "💊", "status": "ACTIVE", "metric_label": "Monitored SKUs", "metric_value": "420 SKUs", "is_custom": true }
  ]
}
```

### 5.2 `GET /api/cortex/stream` (snapshot) · `GET /api/cortex/stream/live` (SSE)
Snapshot returns the latest events; SSE pushes each new event as `event: activity` with the same shape. Clients fall back to polling the snapshot every 3 s if SSE fails.
```json
[
  { "id": "evt-101", "timestamp": "07:02 AM", "agent_id": "priya-sales", "agent_name": "Priya", "agent_avatar": "🎯", "message": "Detected revenue dip (-38%) between 6:00 - 9:00 PM yesterday (Deficit: ₹4,800)", "type": "ANOMALY_DETECTED", "severity": "WARNING" },
  { "id": "evt-102", "timestamp": "07:03 AM", "agent_id": "vikram-procurement", "agent_name": "Vikram", "agent_avatar": "📦", "message": "Traced root cause to Butter Paneer out-of-stock at 5:45 PM. Stock replenished this morning.", "type": "ROOT_CAUSE_ISOLATED", "severity": "INFO" },
  { "id": "evt-103", "timestamp": "07:05 AM", "agent_id": "priya-sales", "agent_name": "Guardrail", "agent_avatar": "🛡️", "message": "Evaluated item gross margin (45% - 10% = 35% net margin). Deterministic Guardrail PASSED.", "type": "GUARDRAIL_PASSED", "severity": "SUCCESS" },
  {
    "id": "evt-104", "timestamp": "07:06 AM", "agent_id": "priya-sales", "agent_name": "Priya", "agent_avatar": "📲",
    "message": "Sent WhatsApp 1-Tap Interactive Card #CMP-44 to merchant phone",
    "type": "DECISION_STAGED", "severity": "WARNING",
    "decision_id": "dec-cmp-44", "decision_kind": "VOUCHER_CAMPAIGN",
    "buttons": [ { "action": "APPROVE", "label": "Approve & Send" }, { "action": "REJECT", "label": "Reject" } ]
  },
  { "id": "evt-110", "timestamp": "11:00 AM", "agent_id": "munim-accounts", "agent_name": "Munim", "agent_avatar": "📒", "message": "3 customers have udhaar > ₹5,000 for 15+ days (total ₹18,600). Drafted polite reminders with UPI links.", "type": "DECISION_STAGED", "severity": "WARNING", "decision_id": "dec-khata-12", "decision_kind": "KHATA_REMINDER_BATCH" },
  { "id": "evt-111", "timestamp": "06:00 PM", "agent_id": "vikram-procurement", "agent_name": "Vikram", "agent_avatar": "📦", "message": "Paneer cover < 1 day. Best of 3 supplier quotes: Sharma Dairy ₹310/kg × 12 kg = ₹3,720.", "type": "DECISION_STAGED", "severity": "WARNING", "decision_id": "dec-po-07", "decision_kind": "PURCHASE_ORDER" },
  { "id": "evt-112", "timestamp": "09:05 AM", "agent_id": "meera-staff", "agent_name": "Meera", "agent_avatar": "👷", "message": "5 of 6 staff checked in via WhatsApp. Raju marked absent (no check-in by 9:00 AM).", "type": "ATTENDANCE_SUMMARY", "severity": "INFO" }
]
```
Event `type` enum: `ANOMALY_DETECTED | ROOT_CAUSE_ISOLATED | COHORT_BUILT | GUARDRAIL_PASSED | GUARDRAIL_BLOCKED | DECISION_STAGED | DECISION_APPROVED | DECISION_REJECTED | ACTION_EXECUTED | SOUNDBOX_ANNOUNCED | DISPUTE_OPENED | PAYMENT_VERIFIED | RECONCILIATION_MISMATCH | COMPLIANCE_DUE | ATTENDANCE_SUMMARY | AGENT_HIRED`.
Severity enum: `INFO | SUCCESS | WARNING | CRITICAL`.

### 5.3 `POST /api/cortex/decisions/:id/action`
Generic for every decision kind: `VOUCHER_CAMPAIGN | PURCHASE_ORDER | PAYROLL_PAYOUT | KHATA_REMINDER_BATCH`.
- **Request**:
```json
{ "action": "APPROVE", "source": "WHATSAPP" }
```
`source` enum: `WHATSAPP | TELEGRAM | DESKTOP`. Idempotent: a repeat action on a decided decision returns `409`.
- **Response** (voucher example):
```json
{
  "success": true,
  "decision_id": "dec-cmp-44",
  "decision_kind": "VOUCHER_CAMPAIGN",
  "status": "EXECUTED",
  "result": { "dispatched_vouchers": 28, "attributed_projected_revenue": 3200 },
  "soundbox_triggered": true,
  "soundbox_announcement": "Paytm par 28 regular customers ko recovery offer bhej diya gaya hai!"
}
```
`result` by kind: `PURCHASE_ORDER → { "po_id", "supplier", "total" }`, `PAYROLL_PAYOUT → { "workers_paid", "total_paid" }`, `KHATA_REMINDER_BATCH → { "reminders_sent", "amount_outstanding" }`.

### 5.4 `POST /api/cortex/custom-agents/generate` · `POST /api/cortex/custom-agents/:id/hire`
- **Generate request**:
```json
{ "prompt": "Track customer credit dues (khata). If balance exceeds ₹5,000 for more than 15 days, send WhatsApp reminder with Paytm UPI link.", "template_id": null }
```
- **Generate response** (status `DRAFT`; `hire` flips it to `HIRED` and adds it to the roster):
```json
{
  "agent_id": "custom-khata-rohan",
  "name": "Rohan - Udhaar Recovery Agent",
  "avatar": "🧾",
  "role": "Wholesale Credit Guardian",
  "trigger": "CRON_HEARTBEAT_DAILY_11AM",
  "tools": ["WHATSAPP_DRAFT", "PAYTM_UPI_LINK_GENERATOR"],
  "guardrails": { "max_messages_per_day": 50, "restricted_hours": "20:00-08:00", "require_merchant_approval": true },
  "status": "DRAFT"
}
```

### 5.5 `GET /api/cortex/metrics`
```json
{
  "today_upi_total": 18420,
  "ai_attributed_revenue": 3850,
  "ai_attributed_percentage": 20.9,
  "disputes_resolved_count": 4,
  "disputes_resolved_amount": 1400,
  "udhaar_recovered_month": 9200,
  "hours_saved_week": 11.5,
  "compliance_next_due": { "title": "GSTR-1 (September)", "due_date": "2026-10-11", "days_left": 14 },
  "campaigns_active": 1,
  "vouchers_redeemed_today": 12
}
```

### 5.6 `GET /api/cortex/khata` · `POST /api/cortex/khata`
```json
{
  "total_outstanding": 42300,
  "entries": [
    { "customer_id": "cus-17", "name": "Gupta Caterers", "phone": "+91 98xxxxxx21", "balance": 8400, "oldest_due_days": 22, "status": "REMINDER_DRAFTED" },
    { "customer_id": "cus-09", "name": "Verma Ji", "phone": "+91 97xxxxxx08", "balance": 5600, "oldest_due_days": 17, "status": "REMINDER_DRAFTED" }
  ]
}
```
POST body (manual entry): `{ "customer_id": "cus-17", "type": "CREDIT" | "PAYMENT", "amount": 1200, "note": "Diwali order" }`.

### 5.7 `GET /api/cortex/accounts/reconciliation?date=2026-09-26`
```json
{
  "date": "2026-09-26",
  "pos_sales_total": 21480,
  "pg_settled_total": 20860,
  "cash_total": 3200,
  "mismatches": [ { "txn_id": "TXN-9021-91", "amount": 620, "reason": "SETTLEMENT_PENDING", "action": "Flagged to Aman" } ],
  "gstr1_draft": { "period": "2026-09", "taxable_value": 412000, "tax": 20600, "export_url": "/api/cortex/accounts/gstr1/2026-09.json" }
}
```

### 5.8 `GET /api/cortex/compliance/calendar`
```json
[
  { "id": "cmp-gstr1-sep", "title": "GSTR-1 (September)", "authority": "GST", "due_date": "2026-10-11", "days_left": 14, "status": "DRAFT_READY" },
  { "id": "cmp-fssai", "title": "FSSAI Licence Renewal", "authority": "FSSAI", "due_date": "2026-11-30", "days_left": 64, "status": "UPCOMING" }
]
```

### 5.9 `GET /api/cortex/procurement/purchase-orders`
```json
[
  {
    "po_id": "PO-07", "decision_id": "dec-po-07", "sku": "Paneer (kg)", "qty": 12, "status": "AWAITING_APPROVAL",
    "quotes": [
      { "supplier": "Sharma Dairy", "unit_price": 310, "eta": "Tomorrow 7 AM", "selected": true },
      { "supplier": "Fresh Farms", "unit_price": 325, "eta": "Tomorrow 9 AM", "selected": false },
      { "supplier": "City Wholesale", "unit_price": 340, "eta": "Today 10 PM", "selected": false }
    ],
    "total": 3720, "last_price": 305, "guardrail": "PASSED (+1.6% vs last price)"
  }
]
```

### 5.10 `GET /api/cortex/staff` · `POST /api/cortex/staff/attendance`
```json
{
  "date": "2026-09-27",
  "present": 5, "total": 6,
  "workers": [
    { "worker_id": "wkr-01", "name": "Raju", "role": "Helper", "check_in": null, "status": "ABSENT", "monthly_salary": 12000, "advance_balance": 2000 },
    { "worker_id": "wkr-02", "name": "Sunita", "role": "Cook", "check_in": "08:52 AM", "status": "PRESENT", "monthly_salary": 18000, "advance_balance": 0 }
  ],
  "next_payday": { "date": "2026-10-01", "decision_id": null, "estimated_total": 84500 }
}
```
POST body (from WhatsApp "haazir" or desktop): `{ "worker_id": "wkr-02", "type": "CHECK_IN" | "CHECK_OUT", "source": "WHATSAPP" }`.

### 5.11 `POST /api/cortex/agents/:id/run`
Manually triggers an agent's routine (demo control). Response: `{ "run_id": "run-331", "agent_id": "priya-sales", "status": "STARTED" }`.

### 5.12 Channel & Demo Routes
| Route | Purpose |
| :--- | :--- |
| `GET /api/channels/whatsapp/webhook` | Meta verification handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST /api/channels/whatsapp/webhook` | Inbound messages, voice notes, button replies → channel gateway |
| `POST /api/channels/simulator/inbound` | Simulate an inbound message/button from the desktop mirror (offline demo) |
| `POST /api/demo/reset` | Re-seed the demo store to its initial state |

Telegram uses long-polling (`getUpdates`) inside the server — no inbound route.

---

## 6. Verification & Quality Gates

Before declaring any milestone complete, run from `cortex/`:
```bash
# 1. Typecheck all workspaces
pnpm -r typecheck

# 2. Guardrail unit tests (margin floor, caps, quiet hours, payout ceiling)
pnpm --filter @cortex/runtime test guardrails

# 3. API contract + workflow scenario verification (server must be running on :3200)
pnpm tsx scripts/verify-api.ts
```
