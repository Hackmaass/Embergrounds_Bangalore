# Cortex — The AI Back-Office for Bharat MSMEs
## Track 3: Bharat Business (AI for MSMEs & Workers) — Hackathon Pitch Deck & Executive Writeup

---

## 1. The One-Liner & The Elevator Pitch

> **"Cortex turns the counter laptop and Paytm Soundbox into an autonomous back-office team of 5 AI employees that sweet shops, kiranas, and restaurants run entirely from WhatsApp with 1-tap approvals."**

### The 30-Second Hook
India has **63 million MSMEs**, and almost every shop owner is simultaneously the cashier, accountant, inventory manager, HR desk, customer support, and legal compliance officer. They don't have time to learn complicated ERPs or install heavy SaaS tools. 

While big enterprises spend millions on Salesforce, SAP, and ServiceNow, Indian small businesses run on registers, memory, and chaotic WhatsApp chats.

**Cortex changes this.** It installs in 10 seconds on the shop laptop, pairs with the merchant’s phone via a single WhatsApp QR scan, and deploys a pre-trained team of AI employees who autonomously detect problems, negotiate with suppliers, recover lost revenue, and prepare GST filings — requiring only a single tap (`[✅ Approve]`) from the merchant on WhatsApp.

---

## 2. The Core Problem: The Bharat MSME Reality

| The Pain Point | What Actually Happens Every Day | The Business Cost |
| :--- | :--- | :--- |
| **Invisible Stockouts & Revenue Leaks** | Paneer runs out at 5:45 PM; kitchen silently stops taking orders during the 7–9 PM dinner rush. | **₹4,000 – ₹8,000 lost revenue** in a single evening. |
| **Counter Payment Panics** | Customer's UPI shows "Money Debited", but Paytm Soundbox has a 4-second network lag. Crowds build, arguments happen. | Customer friction, lost walk-ins, and operator stress. |
| **Awkward Udhaar (Credit) Chasing** | Khata registers have ₹30k–₹50k stuck in credit. The owner feels uncomfortable calling regulars to ask for money. | **Working capital crunch**, delayed supplier payments. |
| **Manual Procurement by Phone** | Owner calls 1 supplier, accepts whatever price is quoted, and writes handwritten purchase slips. | **5%–12% procurement overspend**, frequent stockouts. |
| **Staff & Payroll Chaos** | Workers mark attendance in a diary. Advances and salary cuts cause end-of-month fights. | Staff churn, trust deficit, hours wasted doing payroll math. |
| **Compliance Deadlines Missed** | GSTR-1, FSSAI renewal, and municipal shop licences tracked in memory. | **Heavy late fees & legal stress**. |

---

## 3. The Cortex Solution: Two Products, Zero Friction

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                        PRODUCT 1: IN-STORE DESKTOP COMMAND CENTER                     │
 │          (Runs locally on the counter laptop — Embedded PGlite DB, zero cloud bill)    │
 │                                                                                        │
 │  [ 👥 Workforce Roster ]     [ ⚡ Live Task Stream ]     [ 📱 Phone Mirror ]            │
 │  • Priya (Sales)             • Real-time Agent DAG       • Live WhatsApp preview       │
 │  • Aman (Support & UPI)      • Deterministic Guardrails  • 1-Tap merchant controls     │
 │  • Vikram (Stock/Procure)    • Multi-agent coordination  • Local Ollama Qwen-2.5 AI    │
 │  • Munim (Khata & GST)       • Audit trail of every ₹    • Embedded PGlite (Zero Setup)│
 │  • Meera (Staff & Payroll)   • Soundbox audio engine                                   │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │  Live Bi-directional Sync
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                    PRODUCT 2: ZERO-INSTALL REMOTE (WHATSAPP & TELEGRAM)                │
 │                         No apps to install. QR onboard in 5 seconds.                   │
 │                                                                                        │
 │   👤 MERCHANT                  👷 WORKERS                🚚 SUPPLIERS      🧑 CUSTOMERS  │
 │   • 1-Tap approvals            • WhatsApp "Haazir"       • WhatsApp RFQs   • UPI slips  │
 │   • Voice notes in Hinglish    • Voice payslips (Hindi)  • Auto-drafted POs• Win-back   │
 │   • Morning audio briefings    • Advance salary ledger                     • Khata links│
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Meet The AI Workforce (The Roster)

Each agent is a specialized autonomous employee with domain-specific guardrails:

### 1. 🎯 Priya — Sales & Win-Back Specialist
- **Autonomous Trigger**: 07:00 AM daily diagnostic routine.
- **Workflow**: Scans hourly sales vs. 30-day baseline → Detects a -38% dip between 6–9 PM → Cross-references Vikram’s inventory log → Isolates root cause: *Butter Paneer was out of stock at 5:45 PM; 28 loyal customers went unserved*.
- **Autonomous Action**: Checks margin guardrails (45% gross margin − 10% discount = 35% net margin ≥ 30% floor). Stages a targeted 10% win-back voucher.
- **Merchant Interaction**: Sends a WhatsApp interactive card: `[✅ Approve & Send] [❌ Reject]`. 
- **Attribution**: Tracks coupon redemption over 48 hours and attributes recovered revenue.

### 2. 🛡️ Aman — Customer Support & Instant UPI Dispute Desk
- **Autonomous Trigger**: Owner sends a 2-second voice note on WhatsApp: *"Check ₹350 payment"*.
- **Workflow**: Aman parses Hinglish audio → queries Paytm PG gateway mock for transactions matching ₹350 in the last 5 minutes → checks Soundbox queue telemetry.
- **Instant Resolution**:
  - **Scenario A (Payment Succeeded, Soundbox Lagged)**: Triggers Soundbox Edge Override: *"Paytm par teen sau pachaas rupaye prapt huye"*, eliminating counter arguments.
  - **Scenario B (Bank Pending/Hold)**: Generates a professional dispute ticket (`#PTM-44`) and dispatches a soothing WhatsApp confirmation slip to the customer's phone.
- **KPI**: Resolves counter disputes in **< 4 seconds**.

### 3. 📦 Vikram — Stock & Procurement Manager
- **Autonomous Trigger**: 06:00 PM stock audit + POS low-stock warning.
- **Workflow**: Computes 7-day sales velocity → predicts stockout within 24 hours for Paneer (12 kg deficit) → automatically sends WhatsApp RFQ to 3 verified dairy suppliers.
- **Autonomous Action**: Parses supplier responses, compares quotes (Sharma Dairy: ₹310/kg vs Gupta Dairy: ₹325/kg), verifies price variance is within the 8% guardrail, and drafts a purchase order.
- **Merchant Interaction**: Merchant receives WhatsApp card with supplier comparison and taps `[Approve PO]`. Vikram dispatches the PO directly to the supplier on WhatsApp.

### 4. 📒 Munim — Khata, Accounts & GST Officer
- **Autonomous Trigger**: 11:00 AM khata routine & 21:00 daily close.
- **Workflow**:
  - **Reconciliation**: Matches daily Paytm PG settlements against POS receipts → catches hidden bank deductions or settlement mismatches.
  - **Udhaar Recovery**: Identifies customers with balance > ₹5,000 overdue for 15+ days. Filters against Quiet Hours (no messages before 10 AM or after 8 PM). Drafts polite Hinglish WhatsApp reminders with pre-filled Paytm UPI payment links.
  - **GST & Compliance**: Auto-generates GSTR-1 draft (CSV/JSON) ready for CA review; issues compliance alerts 7 days before FSSAI and Trade Licence deadlines.

### 5. 👷 Meera — Staff & Payroll Desk
- **Autonomous Trigger**: WhatsApp "Haazir" check-ins + monthly payday routine.
- **Workflow**:
  - **Attendance**: Staff check in by texting "haazir" or sending a location pin on WhatsApp. Meera compiles attendance and alerts the owner if anyone is missing by 09:15 AM.
  - **Ledger**: Automatically tracks daily wages, overtime, and salary advances in transparent ledgers.
  - **1-Tap Payday**: Generates net payroll calculations and triggers 1-tap UPI payouts. Sends an audio/visual Hindi payslip to each worker’s WhatsApp.

### 6. ✨ The No-Code Agent Studio — Hire Any Vertical Teammate in 30 Seconds
- Shop owners can type or speak what they need:
  - *"Track expiry dates on dairy batches. Alert me 48 hours before anything spoils."*
  - *"If apparel inventory sits unsold for 30 days, run a weekend clearance offer."*
- **The Compiler**: Translates natural language into a validated JSON/zod contract with sandboxed tools, cron triggers, and deterministic financial guardrails. The custom agent is immediately hired and visible on the roster.

---

## 5. Architectural & Technical Moats

### 1. Deterministic Financial Guardrails ("LLMs Propose, Code Enforces")
- Financial numbers, discounts, margin floors, and payouts **never** rely on LLM arithmetic.
- Pure TypeScript guardrail functions check:
  - `margin_floor_pct`: Gross margin minus discount must be above 30%.
  - `max_discount_pct`: Strict hard cap on promotional coupons.
  - `max_messages_per_day`: Anti-spam message limits.
  - `quiet_hours`: Regulatory & polite communication windows (e.g., 20:00–10:00).
  - `max_payout_amount`: Payout cannot exceed computed net salary.

### 2. Zero-Friction Channels: WhatsApp Baileys & Telegram
- Integrates both **WhatsApp Cloud API** and **Baileys (WhatsApp Web QR Protocol)**.
- **Zero-Setup Demo**: The merchant scans a QR code on the desktop app, and Cortex is immediately linked to their WhatsApp number. No Meta Business Verification or cloud webhooks required.
- Supports Telegram long-polling and local mock simulators as instant fallbacks.

### 3. Local-First & Edge AI (100% Offline-Safe)
- Runs on **PGlite (Embedded WebAssembly Postgres)**: zero server installation, runs directly on any laptop counter.
- **Local Ollama AI Integration**: Supports `qwen2.5:7b-instruct` optimized for standard 8GB-VRAM laptop GPUs (e.g., RTX 5050 at `num_ctx: 4096`), ensuring merchant privacy and zero cloud token bills.
- **Offline Stub Fallback**: If internet is down or Ollama is offline, deterministic fallbacks ensure the demo and shop operations never crash.

### 4. Hardware Synergy: Paytm Soundbox Audio Hook
- Cortex doesn't replace Paytm hardware — it amplifies it.
- In addition to standard payment chimes, Cortex uses the Soundbox for:
  - Action confirmations: *"Paytm par 28 regular customers ko recovery offer bhej diya gaya hai!"*
  - Morning audio briefings for the owner.
  - Edge dispute overrides when network lags.

---

## 6. Why Paytm Wins (Strategic Alignment & Synergy)

| Paytm Strategic Goal | How Cortex Delivers |
| :--- | :--- |
| **Monetize the Soundbox Fleet** | Transforms the Soundbox from a commodity 1-way speaker into an **interactive AI employee** for the shop. |
| **Merchant Retention & Stickiness** | Once an MSME's khata, staff attendance, supplier RFQs, and sales win-back run on Cortex, switching costs become insurmountable. |
| **UPI & Soundbox Transaction Volume** | Vouchers, udhaar recovery links, and payroll payouts all generate incremental Paytm UPI transaction volume. |
| **Merchant Loan Underwriting (Paytm Credit)** | Munim provides structured, audited khata + inventory + settlement reconciliation data — goldmine telemetry for instant merchant credit scoring. |

---

## 7. Business Impact & ROI (The "Do More with Less" Scorecard)

For a single sweet shop or restaurant doing ₹15,000–₹25,000/day:

| Metric | Before Cortex | With Cortex | Monthly Impact |
| :--- | :--- | :--- | :--- |
| **Recovered Revenue (Stockout Win-Back)** | ₹0 (silent loss) | ₹14,800 / week recovered | **+₹59,200 / month** |
| **Udhaar (Credit) Recovery** | 45+ days delayed | Recovered in < 7 days | **+₹25,000 cash flow** |
| **Procurement Savings** | Blind single-vendor quotes | Best of 3 quotes via WhatsApp | **₹4,500 / month saved** |
| **Counter Dispute Resolution Time** | 3–5 minutes of arguing | **< 4 seconds** | Friction-free checkout |
| **Owner Time Saved** | 2.5 hours/day on admin | 5 minutes/day (1-tap approvals) | **60+ hours saved / month** |

---

## 8. The 3-Minute Hackathon Demo Script (Judge Walkthrough)

### ⏱️ Minute 0:00 – 0:45: The Problem & The Command Center
- *"Judges, meet Ramesh ji, owner of Ramesh Sweets. He runs a ₹20 lakh/year business from a diary, a phone, and a Paytm Soundbox. He works 14 hours a day because he is the sales manager, accountant, procurement guy, and cashier."*
- Show the **Cortex Command Center** running on the counter laptop.
- Show the **Workforce Roster**: Priya, Aman, Vikram, Munim, Meera, and Expiry Sentinel.
- Point out the status: *Everything is running locally with embedded PGlite and local AI.*

### ⏱️ Minute 0:45 – 1:30: Hero Workflow 1 — Autonomous Sales Win-Back (Priya & Vikram)
- Show the Live Activity Stream at 07:00 AM:
  - Priya spots a **-38% dip** between 6–9 PM yesterday.
  - Vikram traces the cause: *Butter Paneer was out of stock at 5:45 PM; 28 regulars left without buying.*
  - The deterministic guardrail checks: 45% margin − 10% discount = 35% net margin (PASSED).
- Switch view to the **WhatsApp Phone Mirror**:
  - A real interactive card arrives on Ramesh's phone: *"Send 10% voucher to 28 regulars? Cost: ₹140, Projected Return: ₹3,200"*.
  - Tap **[✅ Approve & Send]**.
  - **Live Soundbox chime**: *"Paytm par 28 regular customers ko recovery offer bhej diya gaya hai!"*
  - The live DAG updates in real-time.

### ⏱️ Minute 1:30 – 2:15: Hero Workflow 2 — Voice Note UPI Reconcile (Aman)
- Live voice demonstration:
  - Send a 2-second voice note to Aman on WhatsApp: *"Aman, check ₹350 payment"*.
  - Aman transcribes Hinglish, reconciles PG records against the Soundbox queue.
  - Triggers the Soundbox audio override and returns a clean WhatsApp receipt in **< 4 seconds**.

### ⏱️ Minute 2:15 – 3:00: The Studio & The Paytm Advantage
- Open the **No-Code Studio**:
  - Type: *"If milk batches expire in 24 hours, alert me and draft a 15% discount for evening milk cake preparation."*
  - Watch the compiler instantly build a sandboxed, guardrailed agent and add it to the roster.
- **Closing Pitch**:
  - *"Cortex requires zero training, zero app downloads, and zero cloud expenses. By combining Paytm's trusted Soundbox with an autonomous AI workforce on WhatsApp, we empower 63 million Indian businesses to truly do more with less."*

---

## 9. Frequently Asked Questions (Judge Defense Sheet)

#### Q1: "Why WhatsApp? Why not build a dedicated mobile app?"
> **Answer**: MSME merchants and workers already spend 4+ hours a day on WhatsApp. Asking a busy kirana owner or daily wage worker to download, learn, and log into a new mobile app creates 90% onboarding drop-off. By putting the remote control inside WhatsApp and Telegram, adoption is instantaneous with zero learning curve.

#### Q2: "Can the LLM hallucinate financial figures or send unapproved discounts?"
> **Answer**: Absolutely not. We built Cortex with a strict **Deterministic Financial Guardrail Engine**. Money math, margin thresholds, discount caps, and payroll sums are calculated using pure TypeScript functions. The LLM is only used for intent classification and text formatting. Furthermore, no money or promotion can move without an HMAC-signed Decision Contract approved via the merchant's 1-tap WhatsApp button.

#### Q3: "Does this require high-end cloud infrastructure?"
> **Answer**: No. Cortex is engineered as a **Local-First Edge Architecture**. It uses embedded PGlite (Postgres compiled to WebAssembly) and can run completely local models like Qwen-2.5 on a laptop's 8GB GPU using Ollama. For shops with low connectivity, it has deterministic offline fallback stubs.

#### Q4: "How does this make business sense for Paytm?"
> **Answer**: Paytm already owns the merchant counter with millions of Soundbox devices. Cortex supercharges the Soundbox into a high-value subscription service (SaaS revenue), drives higher UPI velocity through automated promotions and khata recovery, and provides pristine khata telemetry for underwriting Paytm Merchant Loans.
