import { useState } from "react";
import type { ActivityEvent } from "@cortex/shared";

const TAG_COLOR: Record<string, string> = {
  ANOMALY_DETECTED: "amber",
  RECONCILIATION_MISMATCH: "amber",
  ROOT_CAUSE_ISOLATED: "blue",
  COHORT_BUILT: "blue",
  GUARDRAIL_PASSED: "green",
  ACTION_EXECUTED: "green",
  PAYMENT_VERIFIED: "green",
  GUARDRAIL_BLOCKED: "red",
  DISPUTE_OPENED: "red",
  DECISION_REJECTED: "red",
  DECISION_STAGED: "purple",
  AGENT_HIRED: "purple",
  SOUNDBOX_ANNOUNCED: "sky",
  COMPLIANCE_DUE: "slate",
  ATTENDANCE_SUMMARY: "slate",
  DECISION_APPROVED: "green",
};

const FILTERS: Array<{ id: string; label: string; match: (e: ActivityEvent) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "priya-sales", label: "Priya", match: (e) => e.agent_id === "priya-sales" },
  { id: "aman-support", label: "Aman", match: (e) => e.agent_id === "aman-support" },
  { id: "vikram-procurement", label: "Vikram", match: (e) => e.agent_id === "vikram-procurement" },
  { id: "munim-accounts", label: "Munim", match: (e) => e.agent_id === "munim-accounts" },
  { id: "meera-staff", label: "Meera", match: (e) => e.agent_id === "meera-staff" },
  { id: "custom", label: "Custom", match: (e) => e.agent_id.startsWith("custom-") },
];

export function LiveTaskStream(props: {
  events: ActivityEvent[];
  decidedIds: Set<string | undefined>;
  onDecision: (decisionId: string, action: "APPROVE" | "REJECT") => void;
}) {
  const [filter, setFilter] = useState("all");
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]!;
  const filtered = props.events.filter(active.match);

  return (
    <section className="card">
      <div className="card-title">⚡ Live Workforce Activity Stream (Task DAG)</div>
      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? " active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="stream-list">
        {filtered.length === 0 && <div className="empty-state">No activity yet — trigger an agent to see the workforce in action.</div>}
        {[...filtered].reverse().map((e) => (
          <div className="stream-item" key={e.id}>
            <div className="stream-item__time">{e.timestamp}</div>
            <div className="stream-item__avatar">{e.agent_avatar}</div>
            <div className="stream-item__body">
              <div className="stream-item__message">{e.message}</div>
              <div className="stream-item__meta">
                <span className={`tag ${TAG_COLOR[e.type] ?? "slate"}`}>{e.type.replace(/_/g, " ")}</span>
              </div>
              {e.decision_id && e.buttons && !props.decidedIds.has(e.decision_id) && (
                <div className="inline-decision-actions">
                  {e.buttons.map((b) => (
                    <button
                      key={b.action}
                      className={b.action === "APPROVE" ? "approve" : "reject"}
                      onClick={() => props.onDecision(e.decision_id!, b.action)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
