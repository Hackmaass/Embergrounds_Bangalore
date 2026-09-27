import { useState } from "react";
import type { ActivityEvent, DecisionActionResponse, DecisionRejectResponse } from "@cortex/shared";
import type { WorkforceResponse } from "@cortex/shared";
import { WorkforceRoster } from "../components/WorkforceRoster.js";
import { LiveTaskStream } from "../components/LiveTaskStream.js";
import { RemoteControlMirror } from "../components/RemoteControlMirror.js";
import { OutcomesBar } from "../components/OutcomesBar.js";
import type { PendingDecision } from "../hooks/usePendingDecisions.js";
import { usePolling } from "../hooks/usePolling.js";
import { api } from "../api.js";

type DecisionResponse = DecisionActionResponse | DecisionRejectResponse | undefined;

export function CommandCenterView(props: {
  events: ActivityEvent[];
  pending: PendingDecision[];
  workforce: { data?: WorkforceResponse; refresh: () => Promise<void> };
  onDecision: (decisionId: string, action: "APPROVE" | "REJECT") => Promise<DecisionResponse>;
  onGoToStudio: () => void;
}) {
  const metrics = usePolling(api.getMetrics, 4000);
  const decidedIds = new Set(
    props.events.filter((e) => e.type === "ACTION_EXECUTED" || e.type === "DECISION_REJECTED").map((e) => e.decision_id),
  );

  return (
    <div className="view">
      <WorkforceRoster
        agents={props.workforce.data?.agents ?? []}
        onGoToStudio={props.onGoToStudio}
        onChanged={() => void props.workforce.refresh()}
      />
      <div className="command-split">
        <LiveTaskStream events={props.events} decidedIds={decidedIds} onDecision={(id, a) => void props.onDecision(id, a)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RemoteControlMirror pending={props.pending} onDecision={props.onDecision} />
          {props.workforce.data?.store.channels.whatsapp === "SIMULATOR" && <SimulatorInput onSent={() => void metrics.refresh()} />}
        </div>
      </div>
      <OutcomesBar metrics={metrics.data} />
    </div>
  );
}

function SimulatorInput(props: { onSent: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(): Promise<void> {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.sendSimulatorInbound({ channel: "WHATSAPP", role: "OWNER", identity_id: "owner-1", text });
      setText("");
      props.onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <div className="simulator-input">
        <input
          placeholder="Send as owner… (e.g. Check ₹350)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        <button className="btn" onClick={() => void send()} disabled={sending}>
          Send
        </button>
      </div>
    </div>
  );
}
