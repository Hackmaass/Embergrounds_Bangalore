import { useState } from "react";
import { NavRail, type ViewId } from "./components/NavRail.js";
import { StoreHeader } from "./components/StoreHeader.js";
import { useActivityStream } from "./hooks/useActivityStream.js";
import { usePendingDecisions } from "./hooks/usePendingDecisions.js";
import { usePolling } from "./hooks/usePolling.js";
import { api } from "./api.js";
import { CommandCenterView } from "./views/CommandCenterView.js";
import { KhataAccountsView } from "./views/KhataAccountsView.js";
import { StockPurchaseView } from "./views/StockPurchaseView.js";
import { StaffView } from "./views/StaffView.js";
import { StudioView } from "./views/StudioView.js";
import { ChannelsView } from "./views/ChannelsView.js";

export default function App() {
  const [view, setView] = useState<ViewId>("command");
  const { events, live, refresh: refreshStream } = useActivityStream();
  const pending = usePendingDecisions(events);
  const workforce = usePolling(api.getWorkforce, 5000);

  const badgeCounts: Partial<Record<ViewId, number>> = {
    khata: pending.filter((p) => p.decision_kind === "KHATA_REMINDER_BATCH").length,
    stock: pending.filter((p) => p.decision_kind === "PURCHASE_ORDER").length,
    staff: pending.filter((p) => p.decision_kind === "PAYROLL_PAYOUT").length,
  };

  async function handleDecision(decisionId: string, action: "APPROVE" | "REJECT") {
    try {
      return await api.decideDecision(decisionId, action, "DESKTOP");
    } finally {
      void refreshStream();
      void workforce.refresh();
    }
  }

  return (
    <div className="app-shell">
      <NavRail active={view} onChange={setView} badgeCounts={badgeCounts} />
      <div className="app-main">
        <StoreHeader store={workforce.data?.store} live={live} />
        {view === "command" && (
          <CommandCenterView
            events={events}
            pending={pending}
            workforce={workforce}
            onDecision={handleDecision}
            onGoToStudio={() => setView("studio")}
          />
        )}
        {view === "khata" && <KhataAccountsView />}
        {view === "stock" && <StockPurchaseView onDecision={handleDecision} />}
        {view === "staff" && <StaffView pending={pending} onDecision={handleDecision} />}
        {view === "studio" && <StudioView onHired={() => void workforce.refresh()} />}
        {view === "channels" && <ChannelsView store={workforce.data?.store} onReset={() => void refreshStream()} />}
      </div>
    </div>
  );
}
