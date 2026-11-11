// src/health/records/HealthOverviewCards.js
//
// "সব" পিল — তিনটা লম্বা তালিকার বদলে তিনটা সারাংশ-কার্ড (অসুখ · ওষুধ · রিপোর্ট)। চাপলে সংশ্লিষ্ট পিলে যায়।
// শুধু পড়ে (শেয়ার্ড cache + listDocuments); কিছু লেখে না, নতুন ডেটা/schema নেই।

import { useMemberHealth } from "./useMemberHealth.js";
import { listDocuments, DOC_TYPE_LABELS } from "../documents/documentsData.js";

const { useState, useEffect } = React;
const h = React.createElement;
const G = "var(--hs-primary, #0E4B43)", MUTED = "#5F716C";
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const pad = (n) => String(n).padStart(2, "0");

function localToday() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

const namesLine = (names) => (names.length <= 2 ? names.join(", ") : names.slice(0, 2).join(", ") + " + আরও " + bn(names.length - 2) + "টি");

function card(key, icon, title, count, sub, onClick) {
  return h("button", { key, onClick, "aria-label": title + " " + (count === null ? "" : count) + " — দেখুন",
    style: { width: "100%", minHeight: "64px", display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", marginBottom: "8px", borderRadius: "16px", border: "1px solid #D3E0D9", background: "#fff", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" } },
    h("span", { "aria-hidden": "true", style: { fontSize: "26px", flexShrink: 0 } }, icon),
    h("span", { style: { flex: 1, minWidth: 0 } },
      h("span", { style: { display: "block", fontSize: "15px", fontWeight: 700, color: G } }, title + (count === null ? "" : " · " + bn(count) + "টি")),
      h("span", { style: { display: "block", fontSize: "13px", color: MUTED, overflowWrap: "anywhere", lineHeight: 1.35 } }, sub)),
    h("span", { "aria-hidden": "true", style: { fontSize: "20px", color: G, flexShrink: 0 } }, "›"));
}

export function HealthOverviewCards({ familyId, selectedMemberId, onGo }) {
  const { records, loading, error } = useMemberHealth(familyId, selectedMemberId);
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    if (!selectedMemberId) return undefined;
    listDocuments(familyId, selectedMemberId).then((d) => { if (alive) setDocs(d); }).catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [familyId, selectedMemberId]);

  if (error) return null; // নীরব — নিচের পিলগুলো দিয়েই এগোনো যায়
  const today = localToday();
  const rs = records || [];
  const conds = rs.filter((r) => r.resourceType === "condition" || r.resourceType === "allergy");
  const meds = rs.filter((r) => r.resourceType === "medicationStatement" && !(r.endDate && today > r.endDate));
  const wait = loading || records === null;
  const empty = "এখনো কিছু নেই";

  return h("div", { style: { marginTop: "6px" } },
    card("c", "🩺", "অসুখ ও অ্যালার্জি", wait ? null : conds.length,
      wait ? "লোড হচ্ছে..." : conds.length ? namesLine(conds.map((r) => r.name || r.substance || "?")) : empty, () => onGo("records")),
    card("m", "💊", "চলমান ওষুধ", wait ? null : meds.length,
      wait ? "লোড হচ্ছে..." : meds.length ? namesLine(meds.map((r) => r.genericName || "?")) : empty, () => onGo("meds")),
    card("d", "📁", "রিপোর্ট ও প্রেসক্রিপশন", docs === null ? null : docs.length,
      docs === null ? "লোড হচ্ছে..." : docs.length ? "সর্বশেষ: " + (DOC_TYPE_LABELS[docs[0].docType] || docs[0].docType || "নথি") : empty, () => onGo("docs")));
}
