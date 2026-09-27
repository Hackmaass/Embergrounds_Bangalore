import { useState } from "react";
import type { AgentSummary } from "@cortex/shared";
import { api } from "../api.js";

const STATUS_COLOR: Record<string, string> = {
  MONITORING: "amber",
  READY: "green",
  PO_PENDING: "purple",
  RECONCILED: "blue",
  ACTIVE: "green",
  DRAFT: "slate",
  PAUSED: "slate",
};

export function WorkforceRoster(props: { agents: AgentSummary[]; onGoToStudio: () => void; onChanged: () => void }) {
  return (
    <section className="card">
      <div className="card-title">
        <span>👥 Your AI Workforce</span>
        <button className="btn" onClick={props.onGoToStudio}>
          + Hire New Custom Agent
        </button>
      </div>
      <div className="roster-grid" style={{ padding: 14 }}>
        {props.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onChanged={props.onChanged} />
        ))}
      </div>
    </section>
  );
}

function AgentCard(props: { agent: AgentSummary; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const { agent } = props;

  async function runNow(): Promise<void> {
    setMenuOpen(false);
    setRunning(true);
    try {
      await api.runAgent(agent.id);
      props.onChanged();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="agent-card">
      {agent.is_custom && <span className="agent-card__custom-tag">CUSTOM</span>}
      <div className="agent-card__top">
        <div className="agent-card__avatar-name">
          <span className="agent-card__avatar">{agent.avatar}</span>
          {agent.name}
        </div>
        <button className="agent-card__menu-btn" onClick={() => setMenuOpen((v) => !v)}>
          ⋮
        </button>
      </div>
      {menuOpen && (
        <div style={{ position: "absolute", right: 10, top: 40, background: "white", border: "1px solid var(--card-border)", borderRadius: 8, zIndex: 5 }}>
          <button className="btn secondary" style={{ display: "block", width: "100%", border: "none" }} onClick={runNow} disabled={running}>
            {running ? "Running…" : "Run now"}
          </button>
        </div>
      )}
      <div className="agent-card__role">{agent.role}</div>
      <span className={`pill ${STATUS_COLOR[agent.status] ?? "slate"}`}>{agent.status.replace(/_/g, " ")}</span>
      <div>
        <div className="agent-card__metric-label">{agent.metric_label}</div>
        <div className="agent-card__metric-value">{agent.metric_value}</div>
      </div>
    </div>
  );
}
