import { useState } from "react";
import type { Store } from "@cortex/shared";
import { api } from "../api.js";
import { usePolling } from "../hooks/usePolling.js";

export function ChannelsView(props: { store?: Store; onReset: () => void }) {
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { data: waStatus } = usePolling(() => api.getWhatsAppStatus(), 3000);

  async function resetDemo(): Promise<void> {
    setResetting(true);
    try {
      await api.resetDemo();
      props.onReset();
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  }

  const whatsappMode = waStatus?.status === "CONNECTED" ? "LIVE" : "SIMULATOR";
  const telegramMode = props.store?.channels.telegram === "SIMULATOR" ? "SIMULATOR" : "LIVE";

  return (
    <div className="view">
      <div className="view-header">
        <h2>📡 Channels</h2>
      </div>

      <div className="channels-grid">
        <ChannelCard title="🟢 WhatsApp" linked="+91 98765-XXXXX" mode={whatsappMode} />
        <ChannelCard title="✈️ Telegram" linked="@CortexStoreBot" mode={telegramMode} />
        <ChannelCard title="🔊 Soundbox" linked={props.store ? `Battery ${props.store.soundbox.battery}%` : "—"} mode={props.store?.soundbox.status === "ONLINE" ? "LIVE" : "SIMULATOR"} />
      </div>

      <section className="card">
        <div className="card-title">WhatsApp QR Onboarding</div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {waStatus?.status === "CONNECTED" ? (
            <div className="empty-state" style={{ padding: 0 }}>✅ WhatsApp linked and connected.</div>
          ) : waStatus?.status === "QR_PENDING" && waStatus.qr ? (
            <>
              <img src={waStatus.qr} alt="WhatsApp link QR code" style={{ width: 220, height: 220 }} />
              <div className="empty-state" style={{ padding: 0 }}>
                Scan with WhatsApp → Settings → Linked Devices → Link a Device
              </div>
            </>
          ) : (
            <>
              <div className="qr-box" />
              <div className="empty-state" style={{ padding: 0 }}>Waiting for the server to generate a QR code…</div>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Linked Identities</div>
        <div className="identity-list" style={{ padding: 14 }}>
          <div>👤 Owner — 1 linked</div>
          <div>👷 Staff — 6 linked</div>
          <div>🚚 Suppliers — 3 linked</div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Danger Zone</div>
        <div style={{ padding: 14 }}>
          {!confirming ? (
            <button className="btn danger" onClick={() => setConfirming(true)}>
              Reset Demo
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span>This wipes all activity and reseeds the demo store. Continue?</span>
              <button className="btn danger" onClick={() => void resetDemo()} disabled={resetting}>
                {resetting ? "Resetting…" : "Yes, reset"}
              </button>
              <button className="btn secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ChannelCard(props: { title: string; linked: string; mode: "LIVE" | "SIMULATOR" }) {
  return (
    <div className="channel-card">
      <div style={{ fontWeight: 700 }}>{props.title}</div>
      <div className="empty-state" style={{ padding: 0, textAlign: "left" }}>
        {props.linked}
      </div>
      <span className={`pill ${props.mode === "LIVE" ? "green" : "amber"}`}>{props.mode}</span>
    </div>
  );
}
