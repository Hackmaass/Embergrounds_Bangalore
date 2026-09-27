import type { DecisionActionResponse, DecisionRejectResponse } from "@cortex/shared";
import { usePolling } from "../hooks/usePolling.js";
import { api } from "../api.js";

type DecisionResponse = DecisionActionResponse | DecisionRejectResponse | undefined;

export function StockPurchaseView(props: { onDecision: (decisionId: string, action: "APPROVE" | "REJECT") => Promise<DecisionResponse> }) {
  const pos = usePolling(api.getPurchaseOrders, 4000);

  return (
    <div className="view">
      <div className="view-header">
        <h2>📦 Stock & Purchase</h2>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pos.data?.map((po) => (
          <span key={po.po_id} className="pill amber">
            {po.sku}: {po.qty}
          </span>
        ))}
        {pos.data?.length === 0 && <span className="empty-state">No low-stock SKUs right now.</span>}
      </div>

      {pos.data?.map((po) => (
        <section className="card" key={po.po_id}>
          <div className="card-title">
            <span>
              {po.sku} — {po.qty} units — {po.po_id}
            </span>
            <span className={`pill ${po.status === "AWAITING_APPROVAL" ? "amber" : po.status === "EXECUTED" ? "green" : "red"}`}>
              {po.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="overflow-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Unit Price</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {po.quotes.map((q) => (
                  <tr key={q.supplier} className={q.selected ? "highlight" : ""}>
                    <td>
                      {q.supplier} {q.selected && "✅"}
                    </td>
                    <td>₹{q.unit_price}</td>
                    <td>{q.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              Total: <strong>₹{po.total.toLocaleString("en-IN")}</strong> (last price ₹{po.last_price})
            </div>
            <div className="empty-state" style={{ padding: 0, textAlign: "left" }}>
              Guardrail: {po.guardrail}
            </div>
            {po.status === "AWAITING_APPROVAL" && (
              <div className="inline-decision-actions">
                <button className="approve" onClick={() => void props.onDecision(po.decision_id, "APPROVE").then(() => void pos.refresh())}>
                  Approve
                </button>
                <button className="reject" onClick={() => void props.onDecision(po.decision_id, "REJECT").then(() => void pos.refresh())}>
                  Reject
                </button>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
