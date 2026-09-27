import { useState } from "react";
import type { DecisionActionResponse, DecisionRejectResponse } from "@cortex/shared";
import type { PendingDecision } from "../hooks/usePendingDecisions.js";

type DecisionResponse = DecisionActionResponse | DecisionRejectResponse | undefined;

export function RemoteControlMirror(props: {
  pending: PendingDecision[];
  onDecision: (decisionId: string, action: "APPROVE" | "REJECT") => Promise<DecisionResponse>;
}) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | undefined>(undefined);

  const clampedIndex = props.pending.length === 0 ? 0 : Math.min(index, props.pending.length - 1);
  const current = props.pending[clampedIndex];

  async function act(action: "APPROVE" | "REJECT"): Promise<void> {
    if (!current) return;
    setBusy(true);
    setReceipt(undefined);
    try {
      const res = await props.onDecision(current.decision_id, action);
      if (res && "result" in res) {
        setReceipt(`✅ EXECUTED${res.soundbox_triggered ? " | 🔊 Soundbox announcement triggered" : ""}`);
      } else if (res) {
        setReceipt("❌ Rejected");
      }
    } catch {
      setReceipt("⚠️ Already decided — refresh");
    } finally {
      setBusy(false);
      setTimeout(() => setReceipt(undefined), 4000);
    }
  }

  return (
    <section className="phone-frame">
      <div className="phone-frame__header">📱 Zero-Install Remote Control (WhatsApp Mirror)</div>
      <div className="phone-frame__body">
        {!current && <div className="phone-frame__empty">No pending approvals right now.</div>}
        {current && (
          <div className="wa-bubble">
            <div className="wa-bubble__sender">
              {current.agent_avatar} {current.agent_name}
            </div>
            {current.message}
            <div className="wa-bubble__buttons">
              {current.buttons.map((b) => (
                <button key={b.action} className={b.action === "APPROVE" ? "approve" : "reject"} disabled={busy} onClick={() => act(b.action)}>
                  {b.action === "APPROVE" ? "✅" : "❌"} {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {receipt && <div className="phone-frame__receipt">{receipt}</div>}
      </div>
      {props.pending.length > 1 && (
        <div className="phone-frame__pager">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={clampedIndex === 0}>
            ◀
          </button>
          <span>
            Pending: {props.pending.length} decisions ({clampedIndex + 1}/{props.pending.length})
          </span>
          <button onClick={() => setIndex((i) => Math.min(props.pending.length - 1, i + 1))} disabled={clampedIndex === props.pending.length - 1}>
            ▶
          </button>
        </div>
      )}
    </section>
  );
}
