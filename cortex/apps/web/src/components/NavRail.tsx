export type ViewId = "command" | "khata" | "stock" | "staff" | "studio" | "channels";

const NAV_ITEMS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: "command", icon: "🏠", label: "Home" },
  { id: "khata", icon: "📒", label: "Khata" },
  { id: "stock", icon: "📦", label: "Stock" },
  { id: "staff", icon: "👷", label: "Staff" },
  { id: "studio", icon: "✨", label: "Studio" },
  { id: "channels", icon: "📡", label: "Channels" },
];

export function NavRail(props: {
  active: ViewId;
  onChange: (id: ViewId) => void;
  badgeCounts: Partial<Record<ViewId, number>>;
}) {
  return (
    <nav className="nav-rail">
      <div className="nav-rail__logo">C</div>
      {NAV_ITEMS.map((item) => {
        const count = props.badgeCounts[item.id] ?? 0;
        return (
          <button
            key={item.id}
            className={`nav-rail__item${props.active === item.id ? " active" : ""}`}
            onClick={() => props.onChange(item.id)}
            title={item.label}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
            {count > 0 && <span className="badge">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
