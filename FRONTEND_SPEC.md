# Cortex — Frontend UI Blueprint & Contract Guide
> **For the Frontend Teammate:** This document defines **"what should be where and all"** for the Cortex desktop app (`cortex/apps/web`, React + Vite): layout, components, visual tokens and copy-paste mock data. API contracts are defined in `AGENTS.md` §5 (base URL `http://localhost:3200`).

---

## 1. App Shell & Navigation

A single-window desktop app for counter laptops at `1920x1080` or `1366x768`. A slim **left nav rail** (72px, icons + labels on hover) switches between six views. The **Store Header (A)** is persistent across all views.

| Nav | View | Primary Endpoints |
| :--- | :--- | :--- |
| 🏠 | **Command Center** (default) | `/workforce`, `/stream`, `/stream/live`, `/metrics`, `/decisions/:id/action` |
| 📒 | **Khata & Accounts** | `/khata`, `/accounts/reconciliation`, `/compliance/calendar` |
| 📦 | **Stock & Purchase** | `/procurement/purchase-orders` |
| 👷 | **Staff** | `/staff`, `/staff/attendance` |
| ✨ | **Studio** | `/custom-agents/generate`, `/custom-agents/:id/hire` |
| 📡 | **Channels** | `/workforce` (store.channels), `/api/demo/reset` |

All paths above are under `/api/cortex` unless shown in full.

---

## 2. Command Center Layout ("What Goes Where")

```
+------+----------------------------------------------------------------------------------------------------------------+
| NAV  | [A] STORE HEADER (Full Width, sticky)                                                                          |
|      | [Paytm] Ramesh Sweets & Restaurant | GSTIN: 07AAAAA0000A1Z5 | [🔊 Soundbox 88%] [🟢 WhatsApp] [✈️ Telegram]      |
| 🏠   +----------------------------------------------------------------------------------------------------------------+
| 📒   | [B] WORKFORCE ROSTER (6-slot grid)                                                    [ + Hire New Custom Agent ]|
| 📦   | +--------------+ +--------------+ +--------------+ +--------------+ +--------------+ +--------------+           |
| 👷   | | 🎯 Priya     | | 🛡️ Aman      | | 📦 Vikram    | | 📒 Munim     | | 👷 Meera     | | 💊 Expiry    |           |
| ✨   | | MONITORING   | | READY        | | PO_PENDING   | | RECONCILED   | | ACTIVE       | | ACTIVE       |           |
| 📡   | | ₹14,800 (Wk) | | 18 UPI Holds | | 2 SKUs       | | ₹9,200 (Mo)  | | 5 / 6 Staff  | | 420 SKUs     |           |
|      | +--------------+ +--------------+ +--------------+ +--------------+ +--------------+ +--------------+           |
|      +----------------------------------------------------------------------------------------------------------------+
|      | [C] LIVE TASK STREAM (Left 60%)                      | [D] REMOTE CONTROL LIVE MIRROR (Right 40%)              |
|      | • 07:02 AM | 🎯 Priya | Dip Detected (-38% 6-9 PM)   | Linked Merchant Phone: +91 98765-XXXXX                  |
|      | • 07:03 AM | 📦 Vikram | Butter Paneer OOS 5:45 PM   | ┌── WhatsApp Interactive Card ───────────────────────┐ |
|      | • 07:04 AM | 🎯 Priya | 28 regulars isolated         | │ 🎯 Priya (Sales):                                   │ |
|      | • 07:05 AM | 🛡️ Guardrail | 35% net margin — PASSED | │ "10% Recovery Voucher for 28 Regulars.              │ |
|      | • 07:06 AM | 📲 Priya | 1-Tap Card sent  [Approve]   | │  Cost: ₹140 | Projected Recovery: ₹3,200"           │ |
|      | • 09:05 AM | 👷 Meera | 5/6 staff checked in         | │  [✅ APPROVE & SEND]        [❌ REJECT]             │ |
|      | • 11:00 AM | 📒 Munim | 3 udhaar reminders drafted   | └─────────────────────────────────────────────────────┘ |
|      | • 06:00 PM | 📦 Vikram | PO-07 ₹3,720 drafted        | Pending: 3 decisions  ◀ ▶                               |
|      +----------------------------------------------------------------------------------------------------------------+
|      | [E] OUTCOMES BAR                                                                                               |
|      | Today's UPI ₹18,420 | AI Revenue ₹3,850 (20.9%) | Disputes 4 (₹1,400) | Udhaar ₹9,200 | Saved 11.5 h | GSTR-1: 14 d |
+------+----------------------------------------------------------------------------------------------------------------+
```

---

## 3. Component Blueprint

### `AppShell.tsx` + `NavRail.tsx`
- Nav rail: Paytm Dark Navy `#002970` background, white icons, active item highlighted with Sky Blue `#00BAF2` left bar.
- Badge counts on nav items: pending decisions per area (e.g. 📒 shows `1` when a khata batch awaits approval).

### Section A: `StoreHeader.tsx`
- **Position**: top, sticky, full width (right of nav rail).
- **Left**: Paytm logo badge · store name **"Ramesh Sweets & Restaurant"** (semi-bold 18px) · `GSTIN: 07AAAAA0000A1Z5` pill (slate, monospace).
- **Right**: `🔊 Soundbox: Active (88% 🔋)` with edge-override dot · `🟢 WhatsApp: Connected` · `✈️ Telegram: Polling`. A channel in simulator mode shows an amber `SIMULATOR` pill.
- **Colors**: background `#002970`, text `#FFFFFF`, green pulse dot for live status.

### Section B: `WorkforceRoster.tsx`
- **Position**: below header; responsive grid — 6 columns at 1920px, 3 at 1366px.
- **Top right**: `[ + Hire New Custom Agent ]` → navigates to Studio view.
- **Cards** (from `GET /api/cortex/workforce` → `agents[]`):

| Card | Avatar / Title | Status Badge | Metric |
| :--- | :--- | :--- | :--- |
| Priya | 🎯 Sales & Win-back | `MONITORING` (amber) | Recovered Revenue: ₹14,800 (Wk) |
| Aman | 🛡️ Customer Support & UPI Disputes | `READY` (green) | Disputes Resolved: 18 UPI Holds |
| Vikram | 📦 Stock & Procurement | `PO_PENDING` (purple) | Low Stock SKUs: 2 SKUs |
| Munim | 📒 Accounts, Khata & GST | `RECONCILED` (blue) | Udhaar Recovered: ₹9,200 (Mo) |
| Meera | 👷 Staff & Payroll Desk | `ACTIVE` (green) | Present Today: 5 / 6 Staff |
| Custom | 💊 Expiry Sentinel (`is_custom: true`) | `ACTIVE` (purple, "CUSTOM" corner tag) | Monitored SKUs: 420 SKUs |

- **Card overflow menu**: `Run now` → `POST /api/cortex/agents/:id/run` (demo control).
- **Card styles**: white, `1px solid #E2E8F0`, radius 12px, subtle hover elevation.

### Section C: `LiveTaskStream.tsx`
- **Title**: `⚡ Live Workforce Activity Stream (Task DAG)`.
- **Data**: initial `GET /api/cortex/stream`, then subscribe to `GET /api/cortex/stream/live` (SSE `event: activity`). If SSE errors, poll `/stream` every 3 s.
- **Node anatomy**: monospace timestamp · agent avatar pill · message · tag pill · (optional) inline `[Approve] [Reject]` when `decision_id` is present.
- **Tag colours by `type`**: `ANOMALY_DETECTED`/`RECONCILIATION_MISMATCH` amber · `ROOT_CAUSE_ISOLATED`/`COHORT_BUILT` blue · `GUARDRAIL_PASSED`/`ACTION_EXECUTED`/`PAYMENT_VERIFIED` green · `GUARDRAIL_BLOCKED` red · `DECISION_STAGED` purple · `SOUNDBOX_ANNOUNCED` sky blue · `COMPLIANCE_DUE`/`ATTENDANCE_SUMMARY` slate · `AGENT_HIRED` purple.
- **Filter chips** above the list: All · Priya · Aman · Vikram · Munim · Meera · Custom.

### Section D: `RemoteControlMirror.tsx`
- **Title**: `📱 Zero-Install Remote Control (WhatsApp Mirror)`.
- **Container**: phone frame, header `#075E54`, wallpaper `#ECE5DD`.
- **Content**: the **oldest pending decision** (any `decision_kind`) rendered as a WhatsApp interactive card; `◀ ▶` pager when several are pending.
- **Card copy by kind**:

| `decision_kind` | Sender | Message | Buttons |
| :--- | :--- | :--- | :--- |
| `VOUCHER_CAMPAIGN` | 🎯 Priya | "Namaste Ramesh Ji! ☀️ Kal sham 6-9 PM pe Butter Paneer stockout hone se 28 regular customers laut gaye. Maine 10% apology voucher draft kiya hai (Cost: ₹140, Margin safe: 35% net). Kya hum ye bhej de?" | `✅ Approve & Send` / `❌ Reject` |
| `KHATA_REMINDER_BATCH` | 📒 Munim | "3 customers ka udhaar ₹5,000 se zyada aur 15+ din purana hai (₹18,600). Polite reminder + Paytm UPI link bhej du?" | `✅ Send Reminders` / `❌ Skip` |
| `PURCHASE_ORDER` | 📦 Vikram | "Paneer kal subah khatam ho jayega. Best rate: Sharma Dairy ₹310/kg × 12 kg = ₹3,720. PO bhej du?" | `✅ Place Order` / `❌ Reject` |
| `PAYROLL_PAYOUT` | 👷 Meera | "Payday! 6 staff ki salary ₹84,500 (advances adjusted). Sabko UPI se bhej du?" | `✅ Pay All` / `🔍 Review` |

- **Action**: button → `POST /api/cortex/decisions/:id/action` with `{ "action": "APPROVE" | "REJECT", "source": "DESKTOP" }`. A `409` means it was already decided on the phone — refresh silently.
- **Receipt state** (from response `result`): e.g. `✅ EXECUTED: 28 vouchers sent | 🔊 Soundbox broadcast triggered`, `✅ PO-07 sent to Sharma Dairy (₹3,720)`, `✅ 6 workers paid (₹84,500)`, `✅ 3 reminders sent`.
- **Simulator input** (only when a channel is in simulator mode): a text box "Send as owner…" → `POST /api/channels/simulator/inbound`.

### Section E: `OutcomesBar.tsx`
Six tiles from `GET /api/cortex/metrics`:
1. `Today's UPI Collection` — **₹18,420**.
2. `AI Attributed Revenue` — **₹3,850** (`20.9% of total`, Sky Blue `#00BAF2`).
3. `Auto-Cleared Disputes` — **4 (₹1,400)** (`Avg resolution: 4.2 sec`).
4. `Udhaar Recovered (Month)` — **₹9,200**.
5. `Hours Saved (Week)` — **11.5 h**.
6. `Compliance: Next Due` — **GSTR-1 in 14 days** (amber when ≤ 7 days, red when ≤ 1 day).

---

## 4. Other Views

### 4.1 `KhataAccountsView.tsx` (📒)
- **Left (60%) — Udhaar Ledger** (`GET /api/cortex/khata`): total outstanding tile; table of customer, balance, oldest-due days, status pill (`REMINDER_DRAFTED`, `REMINDED`, `PAID`). Rows > ₹5,000 and > 15 days highlighted amber. `[+ Add Entry]` → `POST /api/cortex/khata`.
- **Right (40%) — Daily Reconciliation** (`GET /api/cortex/accounts/reconciliation`): POS vs PG vs cash totals; mismatch list with reason and action; `GSTR-1 Draft` card with `[Download JSON]` (`export_url`).
- **Bottom — Compliance Calendar** (`GET /api/cortex/compliance/calendar`): horizontal timeline of due items with days-left chips.

### 4.2 `StockPurchaseView.tsx` (📦)
- **Top**: low-stock SKU chips (from the workforce metric / PO list).
- **Main**: purchase-order cards (`GET /api/cortex/procurement/purchase-orders`): SKU, qty, 3-quote comparison table (selected row highlighted green), total, last price, guardrail result, status pill; `[Approve]` `[Reject]` if `AWAITING_APPROVAL`.

### 4.3 `StaffView.tsx` (👷)
- **Top**: `Present 5 / 6` tile, next payday date and estimated total.
- **Main**: worker table (`GET /api/cortex/staff`): name, role, check-in time, status pill (`PRESENT` green / `LATE` amber / `ABSENT` red), monthly salary, advance balance. Row action `[Mark Present]` → `POST /api/cortex/staff/attendance` with `source: "DESKTOP"`.
- **Payday card**: when a `PAYROLL_PAYOUT` decision is pending, show breakdown + `[Pay All]`.

### 4.4 `StudioView.tsx` (✨)
- **Layout**: 2-column split.
  - **Left**: templates (click to prefill): 💊 *Pharmacy Expiry Sentinel* · 🍽️ *Restaurant Rush-Hour Reconciler* · 👗 *Apparel Slow-Mover Liquidation* · 🧾 *Udhaar Recovery Agent*.
  - **Right**: textarea *"Describe what you want your teammate to do..."* → `[ ✨ Generate Teammate ]` (`POST /api/cortex/custom-agents/generate`) → preview card (name, avatar, trigger, tools, guardrails, status `DRAFT`) → `[ ✅ Confirm & Hire ]` (`POST /api/cortex/custom-agents/:id/hire`) → toast + card appears in the roster.
- Loading state while generating: skeleton card with "Compiling teammate…".

### 4.5 `ChannelsView.tsx` (📡)
- One card each for WhatsApp, Telegram, Soundbox: status, linked number/bot, mode (`LIVE` / `SIMULATOR`).
- **QR onboarding** panel: large QR (wa.me link / Telegram bot deep link) with "Scan to connect your phone".
- **Linked identities** list: Owner, Staff (6), Suppliers (3).
- Footer: `[ Reset Demo ]` → `POST /api/demo/reset` (confirm dialog).

---

## 5. Copy-Paste Mock Data (For Instant Frontend Testing)

Field names mirror the API (snake_case) so swapping mocks for real fetches is a one-line change.

```typescript
export const MOCK_CORTEX_DATA = {
  workforce: {
    store: {
      id: "store-ramesh",
      name: "Ramesh Sweets & Restaurant",
      gstin: "07AAAAA0000A1Z5",
      soundbox: { status: "ONLINE", battery: 88, edge_override: true },
      channels: { whatsapp: "CONNECTED", telegram: "CONNECTED" },
    },
    agents: [
      { id: "priya-sales", name: "Priya", role: "Sales & Win-back", avatar: "🎯", status: "MONITORING", metric_label: "Recovered Revenue", metric_value: "₹14,800 (Wk)", is_custom: false },
      { id: "aman-support", name: "Aman", role: "Customer Support & UPI Disputes", avatar: "🛡️", status: "READY", metric_label: "Disputes Resolved", metric_value: "18 UPI Holds", is_custom: false },
      { id: "vikram-procurement", name: "Vikram", role: "Stock & Procurement", avatar: "📦", status: "PO_PENDING", metric_label: "Low Stock SKUs", metric_value: "2 SKUs", is_custom: false },
      { id: "munim-accounts", name: "Munim", role: "Accounts, Khata & GST", avatar: "📒", status: "RECONCILED", metric_label: "Udhaar Recovered", metric_value: "₹9,200 (Mo)", is_custom: false },
      { id: "meera-staff", name: "Meera", role: "Staff & Payroll Desk", avatar: "👷", status: "ACTIVE", metric_label: "Present Today", metric_value: "5 / 6 Staff", is_custom: false },
      { id: "custom-expiry", name: "Expiry Sentinel", role: "Batch Shelf-Life Auditor", avatar: "💊", status: "ACTIVE", metric_label: "Monitored SKUs", metric_value: "420 SKUs", is_custom: true },
    ],
  },

  stream: [
    { id: "evt-101", timestamp: "07:02 AM", agent_id: "priya-sales", agent_name: "Priya", agent_avatar: "🎯", message: "Revenue dip detected: -38% between 6-9 PM yesterday (Deficit: ₹4,800).", type: "ANOMALY_DETECTED", severity: "WARNING" },
    { id: "evt-102", timestamp: "07:03 AM", agent_id: "vikram-procurement", agent_name: "Vikram", agent_avatar: "📦", message: "Root cause isolated: Butter Paneer out of stock at 5:45 PM.", type: "ROOT_CAUSE_ISOLATED", severity: "INFO" },
    { id: "evt-103", timestamp: "07:04 AM", agent_id: "priya-sales", agent_name: "Priya", agent_avatar: "🎯", message: "Identified 28 repeat regular customers who left without buying.", type: "COHORT_BUILT", severity: "INFO" },
    { id: "evt-104", timestamp: "07:05 AM", agent_id: "priya-sales", agent_name: "Guardrail", agent_avatar: "🛡️", message: "Margin Check: 10% discount leaves 35% net margin. Guardrail PASSED.", type: "GUARDRAIL_PASSED", severity: "SUCCESS" },
    { id: "evt-105", timestamp: "07:06 AM", agent_id: "priya-sales", agent_name: "Priya", agent_avatar: "📲", message: "Sent 1-Tap Approval Card to Ramesh Ji on WhatsApp.", type: "DECISION_STAGED", severity: "WARNING", decision_id: "dec-cmp-44", decision_kind: "VOUCHER_CAMPAIGN" },
    { id: "evt-112", timestamp: "09:05 AM", agent_id: "meera-staff", agent_name: "Meera", agent_avatar: "👷", message: "5 of 6 staff checked in via WhatsApp. Raju marked absent.", type: "ATTENDANCE_SUMMARY", severity: "INFO" },
    { id: "evt-110", timestamp: "11:00 AM", agent_id: "munim-accounts", agent_name: "Munim", agent_avatar: "📒", message: "3 customers have udhaar > ₹5,000 for 15+ days (₹18,600). Reminders drafted.", type: "DECISION_STAGED", severity: "WARNING", decision_id: "dec-khata-12", decision_kind: "KHATA_REMINDER_BATCH" },
    { id: "evt-111", timestamp: "06:00 PM", agent_id: "vikram-procurement", agent_name: "Vikram", agent_avatar: "📦", message: "Paneer cover < 1 day. Best quote: Sharma Dairy ₹310/kg × 12 kg = ₹3,720.", type: "DECISION_STAGED", severity: "WARNING", decision_id: "dec-po-07", decision_kind: "PURCHASE_ORDER" },
  ],

  metrics: {
    today_upi_total: 18420,
    ai_attributed_revenue: 3850,
    ai_attributed_percentage: 20.9,
    disputes_resolved_count: 4,
    disputes_resolved_amount: 1400,
    udhaar_recovered_month: 9200,
    hours_saved_week: 11.5,
    compliance_next_due: { title: "GSTR-1 (September)", due_date: "2026-10-11", days_left: 14 },
    campaigns_active: 1,
    vouchers_redeemed_today: 12,
  },

  khata: {
    total_outstanding: 42300,
    entries: [
      { customer_id: "cus-17", name: "Gupta Caterers", phone: "+91 98xxxxxx21", balance: 8400, oldest_due_days: 22, status: "REMINDER_DRAFTED" },
      { customer_id: "cus-09", name: "Verma Ji", phone: "+91 97xxxxxx08", balance: 5600, oldest_due_days: 17, status: "REMINDER_DRAFTED" },
      { customer_id: "cus-22", name: "Rana Tent House", phone: "+91 99xxxxxx45", balance: 4600, oldest_due_days: 19, status: "REMINDER_DRAFTED" },
    ],
  },

  reconciliation: {
    date: "2026-09-26",
    pos_sales_total: 21480,
    pg_settled_total: 20860,
    cash_total: 3200,
    mismatches: [{ txn_id: "TXN-9021-91", amount: 620, reason: "SETTLEMENT_PENDING", action: "Flagged to Aman" }],
    gstr1_draft: { period: "2026-09", taxable_value: 412000, tax: 20600, export_url: "/api/cortex/accounts/gstr1/2026-09.json" },
  },

  compliance: [
    { id: "cmp-gstr1-sep", title: "GSTR-1 (September)", authority: "GST", due_date: "2026-10-11", days_left: 14, status: "DRAFT_READY" },
    { id: "cmp-fssai", title: "FSSAI Licence Renewal", authority: "FSSAI", due_date: "2026-11-30", days_left: 64, status: "UPCOMING" },
  ],

  purchaseOrders: [
    {
      po_id: "PO-07", decision_id: "dec-po-07", sku: "Paneer (kg)", qty: 12, status: "AWAITING_APPROVAL",
      quotes: [
        { supplier: "Sharma Dairy", unit_price: 310, eta: "Tomorrow 7 AM", selected: true },
        { supplier: "Fresh Farms", unit_price: 325, eta: "Tomorrow 9 AM", selected: false },
        { supplier: "City Wholesale", unit_price: 340, eta: "Today 10 PM", selected: false },
      ],
      total: 3720, last_price: 305, guardrail: "PASSED (+1.6% vs last price)",
    },
  ],

  staff: {
    date: "2026-09-27",
    present: 5,
    total: 6,
    workers: [
      { worker_id: "wkr-01", name: "Raju", role: "Helper", check_in: null, status: "ABSENT", monthly_salary: 12000, advance_balance: 2000 },
      { worker_id: "wkr-02", name: "Sunita", role: "Cook", check_in: "08:52 AM", status: "PRESENT", monthly_salary: 18000, advance_balance: 0 },
      { worker_id: "wkr-03", name: "Imran", role: "Counter", check_in: "09:12 AM", status: "LATE", monthly_salary: 14000, advance_balance: 1500 },
    ],
    next_payday: { date: "2026-10-01", decision_id: null, estimated_total: 84500 },
  },
};
```

---

## 6. Official Color Palette & Design Tokens

- **Paytm Dark Navy**: `#002970` — nav rail, header, primary headings.
- **Paytm Sky Blue**: `#00BAF2` — highlighted metrics, active nav, primary buttons.
- **WhatsApp Green**: `#075E54` (header) / `#25D366` (buttons, live pills); chat wallpaper `#ECE5DD`.
- **Card White**: `#FFFFFF` with borders `#E2E8F0` and radius `12px`.
- **Status Green**: `#10B981` (online, passed, approved, present).
- **Warning Amber**: `#F59E0B` (anomalies, pending approval, late, simulator mode).
- **Danger Red**: `#EF4444` (blocked guardrail, absent, compliance ≤ 1 day).
- **Decision Purple**: `#8B5CF6` (decision staged, custom agent tag).
- Define all of these as CSS variables in one token file; components never hard-code hex values.
