import { useState } from "react";
import type { CustomAgentSpec } from "@cortex/shared";
import { usePolling } from "../hooks/usePolling.js";
import { api } from "../api.js";

export function StudioView(props: { onHired: () => void }) {
  const templates = usePolling(api.getStudioTemplates, 60_000);
  const [prompt, setPrompt] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [spec, setSpec] = useState<CustomAgentSpec | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | undefined>(undefined);

  async function generate(): Promise<void> {
    if (!prompt.trim()) return;
    setCompiling(true);
    setError(undefined);
    setSpec(undefined);
    try {
      setSpec(await api.generateCustomAgent(prompt, templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compilation failed — try rephrasing.");
    } finally {
      setCompiling(false);
    }
  }

  async function hire(): Promise<void> {
    if (!spec) return;
    const hired = await api.hireCustomAgent(spec.agent_id);
    setSpec(hired);
    setToast(`${hired.name} joined the team!`);
    props.onHired();
    setTimeout(() => setToast(undefined), 4000);
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>✨ Cortex Agent Studio: "Hire a Teammate"</h2>
      </div>
      {toast && <div className="pill green">{toast}</div>}

      <div className="studio-split">
        <section className="card">
          <div className="card-title">Templates</div>
          <div style={{ padding: 14 }}>
            {templates.data?.map((t) => (
              <div
                key={t.template_id}
                className="template-card"
                onClick={() => {
                  setTemplateId(t.template_id);
                  setPrompt(t.prompt);
                }}
              >
                <div className="template-card__title">
                  {t.avatar} {t.name}
                </div>
                <div className="template-card__desc">{t.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-title">Prompt-to-Agent</div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              className="studio-textarea"
              placeholder="Describe what you want your teammate to do..."
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setTemplateId(null);
              }}
            />
            <button className="btn" onClick={() => void generate()} disabled={compiling || !prompt.trim()}>
              ✨ Generate Teammate
            </button>

            {compiling && <div className="skeleton-card">Compiling teammate…</div>}
            {error && <div className="pill red">{error}</div>}

            {spec && (
              <div className="compiled-spec">
                <strong>
                  {spec.avatar} {spec.name}
                </strong>
                <div>Role: {spec.role}</div>
                <div>Trigger: {spec.trigger}</div>
                <div>Tools: {spec.tools.join(", ")}</div>
                <div>
                  Guardrails: ≤{spec.guardrails.max_messages_per_day} msgs/day; quiet hours {spec.guardrails.restricted_hours}; merchant approval{" "}
                  {spec.guardrails.require_merchant_approval ? "required" : "off"}
                </div>
                <span className={`pill ${spec.status === "DRAFT" ? "amber" : "green"}`}>{spec.status}</span>
                {spec.status === "DRAFT" && (
                  <button className="btn" onClick={() => void hire()}>
                    ✅ Confirm & Hire Teammate
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
