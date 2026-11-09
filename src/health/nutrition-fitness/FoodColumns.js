// খাবারের তালিকা — ❌ এড়িয়ে চলুন | ✅ খাবেন পাশাপাশি দুই কলামে, প্রতিটি বুলেটে।
// প্রোফাইল-কার্ড (HealthSummaryCard) ও খাদ্য নির্দেশিকা (DietGuidanceSection) একই UI ব্যবহার করে।
// শুধু display; কোনো data/schema বদল নেই।

function bulletList(items, color, sources) {
  const mk = (x, i) => React.createElement("li", { key: i, style: { marginBottom: "4px", overflowWrap: "anywhere" } }, x,
    sources && sources[x] && sources[x].length > 1 && React.createElement("span", { style: { color: "#6B7B76", fontSize: "12px" } }, " (" + sources[x].join(", ") + ")"));
  return { mk, color };
}

function column(title, items, color, bg, sources, limit) {
  const clean = items.map((x) => String(x).trim()).filter(Boolean);
  const { mk } = bulletList(clean, color, sources);
  const first = limit ? clean.slice(0, limit) : clean;
  const rest = limit ? clean.slice(limit) : [];
  const ulStyle = { margin: 0, paddingLeft: "18px", fontSize: "14px", color: "#1F2D2A", lineHeight: 1.5 };
  return React.createElement("div", { style: { background: bg, borderRadius: "12px", padding: "10px", minWidth: 0 } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color, marginBottom: "6px" } }, title),
    clean.length === 0
      ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, "নির্দিষ্ট কিছু নেই")
      : React.createElement("ul", { style: ulStyle }, first.map(mk)),
    rest.length > 0 && React.createElement("details", { style: { marginTop: "4px" } },
      React.createElement("summary", { style: { fontSize: "14px", color, cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center" } }, "আরও " + rest.length + "টি ▾"),
      React.createElement("ul", { style: { ...ulStyle, marginTop: "2px" } }, rest.map((x, i) => mk(x, i + first.length)))));
}

// avoid/include: string[]; sources: { খাবার: [tag,...] } (ঐচ্ছিক); limit: প্রতি কলামে প্রথমে কয়টা (ঐচ্ছিক)।
// দুই দিকের একটা খালি হলে শুধু অন্যটা পুরো প্রস্থে।
export function foodColumns({ avoid, include, avoidSources, limit }) {
  const hasAvoid = avoid.length > 0, hasInclude = include.length > 0;
  if (!hasAvoid && !hasInclude) return null;
  const both = hasAvoid && hasInclude;
  return React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: both ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: "8px", marginTop: "8px" },
  },
    hasAvoid && column("❌ এড়িয়ে চলুন", avoid, "#B3261E", "#FDF0EE", avoidSources, limit),
    hasInclude && column("✅ খাবেন", include, "#0E4B43", "#EAF6F0", null, limit));
}
