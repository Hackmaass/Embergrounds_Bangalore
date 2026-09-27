import type { MetricsResponse } from "@cortex/shared";

export function OutcomesBar(props: { metrics?: MetricsResponse }) {
  const m = props.metrics;
  const complianceUrgent = (m?.compliance_next_due.days_left ?? 99) <= 1;
  const complianceSoon = (m?.compliance_next_due.days_left ?? 99) <= 7;

  return (
    <section className="outcomes-bar">
      <Tile label="Today's UPI Collection" value={m ? `₹${m.today_upi_total.toLocaleString("en-IN")}` : "—"} />
      <Tile
        label="AI Attributed Revenue"
        value={m ? `₹${m.ai_attributed_revenue.toLocaleString("en-IN")}` : "—"}
        sub={m ? `${m.ai_attributed_percentage}% of total` : undefined}
        colorClass="sky"
      />
      <Tile
        label="Auto-Cleared Disputes"
        value={m ? `${m.disputes_resolved_count} (₹${m.disputes_resolved_amount.toLocaleString("en-IN")})` : "—"}
      />
      <Tile label="Udhaar Recovered (Month)" value={m ? `₹${m.udhaar_recovered_month.toLocaleString("en-IN")}` : "—"} />
      <Tile label="Hours Saved (Week)" value={m ? `${m.hours_saved_week} h` : "—"} />
      <Tile
        label="Compliance: Next Due"
        value={m ? `${m.compliance_next_due.title.split(" ")[0]} in ${m.compliance_next_due.days_left}d` : "—"}
        colorClass={complianceUrgent ? "red" : complianceSoon ? "amber" : undefined}
      />
    </section>
  );
}

function Tile(props: { label: string; value: string; sub?: string; colorClass?: string }) {
  return (
    <div className="outcome-tile">
      <div className="outcome-tile__label">{props.label}</div>
      <div className={`outcome-tile__value${props.colorClass ? ` ${props.colorClass}` : ""}`}>{props.value}</div>
      {props.sub && <div className="outcome-tile__sub">{props.sub}</div>}
    </div>
  );
}
