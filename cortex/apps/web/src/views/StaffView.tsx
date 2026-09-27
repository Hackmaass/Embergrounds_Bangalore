import type { DecisionActionResponse, DecisionRejectResponse } from "@cortex/shared";
import { usePolling } from "../hooks/usePolling.js";
import { api } from "../api.js";
import type { PendingDecision } from "../hooks/usePendingDecisions.js";

type DecisionResponse = DecisionActionResponse | DecisionRejectResponse | undefined;

const STATUS_COLOR: Record<string, string> = { PRESENT: "green", LATE: "amber", ABSENT: "red" };

export function StaffView(props: {
  pending: PendingDecision[];
  onDecision: (decisionId: string, action: "APPROVE" | "REJECT") => Promise<DecisionResponse>;
}) {
  const staff = usePolling(api.getStaff, 4000);
  const payrollDecision = props.pending.find((p) => p.decision_kind === "PAYROLL_PAYOUT");

  async function markPresent(workerId: string): Promise<void> {
    await api.markAttendance(workerId, "CHECK_IN");
    void staff.refresh();
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>👷 Staff</h2>
        {staff.data && (
          <span className="pill blue">
            Present {staff.data.present} / {staff.data.total}
          </span>
        )}
      </div>

      {staff.data?.next_payday && (
        <section className="card">
          <div className="card-title">Next Payday — {staff.data.next_payday.date}</div>
          <div style={{ padding: 14, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>Estimated total: ₹{staff.data.next_payday.estimated_total.toLocaleString("en-IN")}</div>
            {payrollDecision && (
              <>
                <div>{payrollDecision.message}</div>
                <div className="inline-decision-actions">
                  <button className="approve" onClick={() => void props.onDecision(payrollDecision.decision_id, "APPROVE").then(() => void staff.refresh())}>
                    Pay All
                  </button>
                  <button className="reject" onClick={() => void props.onDecision(payrollDecision.decision_id, "REJECT").then(() => void staff.refresh())}>
                    Review
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-title">Worker Ledger</div>
        <div className="overflow-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Check-in</th>
                <th>Status</th>
                <th>Salary</th>
                <th>Advance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.data?.workers.map((w) => (
                <tr key={w.worker_id}>
                  <td>{w.name}</td>
                  <td>{w.role}</td>
                  <td>{w.check_in ?? "—"}</td>
                  <td>
                    <span className={`pill ${STATUS_COLOR[w.status] ?? "slate"}`}>{w.status}</span>
                  </td>
                  <td>₹{w.monthly_salary.toLocaleString("en-IN")}</td>
                  <td>₹{w.advance_balance.toLocaleString("en-IN")}</td>
                  <td>
                    {w.status === "ABSENT" && (
                      <button className="btn secondary" onClick={() => void markPresent(w.worker_id)}>
                        Mark Present
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
