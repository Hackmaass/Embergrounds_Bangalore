import type { Store } from "@cortex/shared";

export function StoreHeader(props: { store?: Store; live: boolean }) {
  const { store } = props;
  return (
    <header className="store-header">
      <div className="store-header__left">
        <div className="store-header__badge">cortex</div>
        <div className="store-header__name">{store?.name ?? "Loading store…"}</div>
        {store && <div className="store-header__gstin">GSTIN: {store.gstin}</div>}
      </div>
      <div className="store-header__right">
        {store && (
          <>
            <span className="status-chip">
              🔊 Soundbox: {store.soundbox.status === "ONLINE" ? "Active" : store.soundbox.status} ({store.soundbox.battery}%🔋)
              {store.soundbox.edge_override && <span className="status-dot" title="Edge override enabled" />}
            </span>
            <ChannelChip label="WhatsApp" status={store.channels.whatsapp} icon="🟢" />
            <ChannelChip label="Telegram" status={store.channels.telegram} icon="✈️" />
          </>
        )}
        <span className="status-chip" title="Live activity stream connection">
          <span className={`status-dot${props.live ? "" : " simulator"}`} />
          {props.live ? "Live" : "Polling"}
        </span>
      </div>
    </header>
  );
}

function ChannelChip(props: { label: string; status: string; icon: string }) {
  const isSim = props.status === "SIMULATOR";
  return (
    <span className="status-chip">
      {props.icon} {props.label}: {isSim ? <span className="pill amber">SIMULATOR</span> : "Connected"}
    </span>
  );
}
