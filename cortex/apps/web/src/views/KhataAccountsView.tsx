import { useState } from "react";
import { usePolling } from "../hooks/usePolling.js";
import { api } from "../api.js";

const STATUS_COLOR: Record<string, string> = { REMINDER_DRAFTED: "amber", REMINDED: "blue", PAID: "green" };

export function KhataAccountsView() {
  const khata = usePolling(api.getKhata, 5000);
  const recon = usePolling(() => api.getReconciliation(), 5000);
  const compliance = usePolling(api.getComplianceCalendar, 15000);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="view">
      <div className="view-header">
        <h2>📒 Khata & Accounts</h2>
      </div>

      <div className="split-60-40">
        <section className="card">
          <div className="card-title">
            <span>Udhaar Ledger — ₹{khata.data?.total_outstanding.toLocaleString("en-IN") ?? "—"} outstanding</span>
            <button className="btn" onClick={() => setShowAdd((v) => !v)}>
              + Add Entry
            </button>
          </div>
          {showAdd && <AddEntryForm onDone={() => { setShowAdd(false); void khata.refresh(); }} />}
          <div className="overflow-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Balance</th>
                  <th>Oldest Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {khata.data?.entries.map((e) => (
                  <tr key={e.customer_id} className={e.balance > 5000 && e.oldest_due_days > 15 ? "highlight" : ""}>
                    <td>{e.name}</td>
                    <td>{e.phone}</td>
                    <td>₹{e.balance.toLocaleString("en-IN")}</td>
                    <td>{e.oldest_due_days}d</td>
                    <td>
                      <span className={`pill ${STATUS_COLOR[e.status] ?? "slate"}`}>{e.status.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
                {khata.data?.entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No outstanding khata entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Daily Reconciliation {recon.data ? `— ${recon.data.date}` : ""}</div>
          {recon.data && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div>POS Sales: ₹{recon.data.pos_sales_total.toLocaleString("en-IN")}</div>
              <div>PG Settled: ₹{recon.data.pg_settled_total.toLocaleString("en-IN")}</div>
              <div>Cash: ₹{recon.data.cash_total.toLocaleString("en-IN")}</div>
              {recon.data.mismatches.map((m) => (
                <div key={m.txn_id} className="pill amber" style={{ width: "fit-content" }}>
                  ₹{m.amount} — {m.reason} ({m.action})
                </div>
              ))}
              <div className="compiled-spec">
                <strong>GSTR-1 Draft ({recon.data.gstr1_draft.period})</strong>
                <div>Taxable Value: ₹{recon.data.gstr1_draft.taxable_value.toLocaleString("en-IN")}</div>
                <div>Tax: ₹{recon.data.gstr1_draft.tax.toLocaleString("en-IN")}</div>
                <a className="btn secondary" style={{ width: "fit-content" }} href={`${api.base}${recon.data.gstr1_draft.export_url}`} target="_blank" rel="noreferrer">
                  Download JSON
                </a>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-title">Compliance Calendar</div>
        <div className="compliance-timeline">
          {compliance.data?.map((c) => (
            <div className="compliance-item" key={c.id}>
              <div className="compliance-item__title">{c.title}</div>
              <div className="compliance-item__auth">{c.authority}</div>
              <span className={`pill ${c.days_left <= 1 ? "red" : c.days_left <= 7 ? "amber" : "slate"}`}>{c.days_left}d left</span>
              <span className="pill blue">{c.status.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AddEntryForm(props: { onDone: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState<"CREDIT" | "PAYMENT">("CREDIT");
  const [amount, setAmount] = useState("");

  async function submit(): Promise<void> {
    if (!customerId || !amount) return;
    await api.addKhataEntry({ customer_id: customerId, type, amount: Number(amount) });
    props.onDone();
  }

  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--card-border)", flexWrap: "wrap" }}>
      <input placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ padding: 6, border: "1px solid var(--card-border)", borderRadius: 6 }} />
      <select value={type} onChange={(e) => setType(e.target.value as "CREDIT" | "PAYMENT")} style={{ padding: 6, border: "1px solid var(--card-border)", borderRadius: 6 }}>
        <option value="CREDIT">Credit</option>
        <option value="PAYMENT">Payment</option>
      </select>
      <input placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ padding: 6, border: "1px solid var(--card-border)", borderRadius: 6, width: 100 }} />
      <button className="btn" onClick={() => void submit()}>
        Save
      </button>
    </div>
  );
}
