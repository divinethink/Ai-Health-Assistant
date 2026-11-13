// খাবারের তালিকা — ❌ এড়িয়ে চলুন | ✅ খাবেন পাশাপাশি দুই কলামে, প্রতিটি বুলেটে।
// প্রোফাইল-কার্ড (HealthSummaryCard) ও খাদ্য নির্দেশিকা (DietGuidanceSection) একই UI ব্যবহার করে।
// শুধু display; কোনো data/schema বদল নেই।

function bulletList(items, color, sources, icon) {
  const mk = (x, i) => React.createElement("li", { key: i, style: { marginBottom: "5px", overflowWrap: "anywhere", listStyle: "none", display: "flex", gap: "5px", alignItems: "flex-start" } },
    React.createElement("span", { "aria-hidden": true, style: { color, fontWeight: 700, flexShrink: 0 } }, icon),
    React.createElement("span", { style: { minWidth: 0 } }, x,
      sources && sources[x] && sources[x].length > 1 && React.createElement("span", { style: { color: "#6B7B76", fontSize: "12px" } }, " (" + sources[x].join(", ") + ")")));
  return { mk, color };
}

// সাম্প্রতিক খাবার (ধাপ ১): কার্ডের শেষে ছোট অংশ। rows: [{name, level, icon, reasons}] বা undefined (= দেখানো নয়)।
const LEVEL_COLOR = { green: "#0E4B43", yellow: "#8A5A00", red: "#B3261E" };
function recentBlock(rows, color, emptyText) {
  if (!rows) return null;
  return React.createElement("div", { style: { marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed " + color + "55" } },
    React.createElement("div", { style: { fontSize: "12px", fontWeight: 700, color, marginBottom: "4px" } }, "🕘 আপনার সাম্প্রতিক খাবার"),
    rows.length === 0
      ? React.createElement("div", { style: { fontSize: "12px", color: "#5F716C" } }, emptyText)
      : React.createElement("ul", { style: { margin: 0, padding: 0, fontSize: "14px", color: "#1F2D2A", lineHeight: 1.5 } }, rows.map((r) =>
        React.createElement("li", { key: r.key, style: { listStyle: "none", display: "flex", gap: "5px", alignItems: "flex-start", marginBottom: "3px", overflowWrap: "anywhere" } },
          React.createElement("span", { "aria-label": r.level === "red" ? "এড়িয়ে চলুন" : r.level === "yellow" ? "সীমিত রাখুন" : "ঠিক আছে", style: { color: LEVEL_COLOR[r.level] || color, fontWeight: 700, flexShrink: 0 } }, r.icon),
          React.createElement("span", { style: { minWidth: 0 } }, r.name,
            r.reasons && r.reasons[0] && React.createElement("span", { style: { color: "#6B7B76", fontSize: "12px" } }, " — " + r.reasons[0]))))));
}

function column(title, items, color, bg, sources, limit, icon, recent, emptyText) {
  const clean = items.map((x) => String(x).trim()).filter(Boolean);
  const { mk } = bulletList(clean, color, sources, icon);
  const first = limit ? clean.slice(0, limit) : clean;
  const rest = limit ? clean.slice(limit) : [];
  const ulStyle = { margin: 0, padding: 0, fontSize: "14px", color: "#1F2D2A", lineHeight: 1.5 };
  return React.createElement("div", { style: { background: bg, borderRadius: "12px", padding: "8px", minWidth: 0, border: "1.5px solid " + (color === "#B3261E" ? "#DB9C95" : "#8FC4A6") } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color, marginBottom: "6px" } }, title),
    clean.length === 0
      ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, "নির্দিষ্ট কিছু নেই")
      : React.createElement("ul", { style: ulStyle }, first.map(mk)),
    rest.length > 0 && React.createElement("details", { style: { marginTop: "4px" } },
      React.createElement("summary", { style: { fontSize: "14px", color, cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center" } }, "আরও " + rest.length + "টি ▾"),
      React.createElement("ul", { style: { ...ulStyle, marginTop: "2px" } }, rest.map((x, i) => mk(x, i + first.length)))),
    recentBlock(recent, color, emptyText));
}

// avoid/include: string[]; sources: { খাবার: [tag,...] } (ঐচ্ছিক); limit: প্রতি কলামে প্রথমে কয়টা (ঐচ্ছিক)।
// দুই দিকের একটা খালি হলে শুধু অন্যটা পুরো প্রস্থে।
// recent (ঐচ্ছিক): { avoid: [...], include: [...] } — দিলে প্রতি কার্ডের শেষে সাম্প্রতিক খাবার; না দিলে আগের মতোই।
export function foodColumns({ avoid, include, avoidSources, limit, recent }) {
  const hasAvoid = avoid.length > 0, hasInclude = include.length > 0;
  if (!hasAvoid && !hasInclude) return null;
  const both = hasAvoid && hasInclude;
  const none = recent && recent.avoid.length === 0 && recent.include.length === 0;
  const hint = "ট্র্যাকারে খাবার যোগ করলে এখানে দেখাবে";
  return React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: both ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: "6px", marginTop: "8px" },
  },
    hasAvoid && column("❌ এড়িয়ে চলুন", avoid, "#B3261E", "#FDF0EE", avoidSources, limit, "✕", recent && recent.avoid, none ? hint : "এড়ানোর মতো সাম্প্রতিক খাবার নেই"),
    hasInclude && column("✅ খাবেন", include, "#0E4B43", "#EAF6F0", null, limit, "✓", recent && recent.include, none ? hint : "সাম্প্রতিক ঠিক-থাকা খাবার নেই"));
}

// 💡 অভ্যাস ও জীবনযাত্রা — খাবার নয় এমন পরামর্শ (ব্যায়াম, খাওয়ার নিয়ম, বিশ্রাম ইত্যাদি)। খাবার-তালিকা থেকে আলাদা।
export function habitTipsBox(tips, limit) {
  const clean = (tips || []).map((x) => String(x).trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const first = limit ? clean.slice(0, limit) : clean;
  const rest = limit ? clean.slice(limit) : [];
  const li = (x, i) => React.createElement("li", { key: i, style: { marginBottom: "5px", listStyle: "none", display: "flex", gap: "6px", alignItems: "flex-start", overflowWrap: "anywhere" } },
    React.createElement("span", { "aria-hidden": true, style: { color: "#8A5A00", fontWeight: 700, flexShrink: 0 } }, "›"),
    React.createElement("span", { style: { minWidth: 0 } }, x));
  const ul = { margin: 0, padding: 0, fontSize: "14px", color: "#1F2D2A", lineHeight: 1.5 };
  return React.createElement("div", { style: { background: "#FFF9EC", border: "1.5px solid #E6CF9A", borderRadius: "12px", padding: "8px", marginTop: "8px" } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#8A5A00", marginBottom: "6px" } }, "💡 অভ্যাস ও জীবনযাত্রা"),
    React.createElement("ul", { style: ul }, first.map(li)),
    rest.length > 0 && React.createElement("details", { style: { marginTop: "4px" } },
      React.createElement("summary", { style: { fontSize: "14px", color: "#8A5A00", cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center" } }, "আরও " + rest.length + "টি ▾"),
      React.createElement("ul", { style: { ...ul, marginTop: "2px" } }, rest.map((x, i) => li(x, i + first.length)))));
}
