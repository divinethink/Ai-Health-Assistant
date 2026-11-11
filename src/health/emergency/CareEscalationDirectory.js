// Verified Care-Escalation Directory UI (roadmap §12.5.1, Architecture Plan
// Part B §5.1, P8 ধাপ ১)। Global data (family-independent), তাই কোনো
// familyId/memberId prop লাগে না — RemedySection.js-এর একই standalone-
// reference প্যাটার্ন।
//
// UI-reorg (owner-approved, ২০২৬-১১-০৮): হটলাইন (জরুরি/স্বাস্থ্য/শিশু/নারী/নাগরিক)
// ভাঁজ ছাড়াই সরাসরি দেখানো হয় — জরুরি দুটো পাশাপাশি লাল কার্ডে, বাকি হটলাইন ২-কলামের
// গ্রিডে, প্রতিটায় "📞 কল" (tel:) বোতাম। ফি-ভিত্তিক অনলাইন সেবা (টেলিমেডিসিন/ফার্মেসি)
// একটাই ভাঁজে। শুধু presentation — data/rules অপরিবর্তিত।

import { ErrorBox, CollapsibleSection } from "../../shared/ui.js";
import { listCareEscalationDirectory, CARE_ESCALATION_TYPE_LABELS } from "./careEscalationData.js";

const { useState, useEffect } = React;

const EMERGENCY_TYPE = "emergency-police-fire";
const ONLINE_TYPES = ["telemedicine", "pharmacist-consult"];

const isPhone = (c) => /^[\d০-৯+\s-]{2,15}$/.test((c || "").trim());
const isDomain = (c) => /^[\w-]+(\.[\w-]+)+$/.test((c || "").trim());
// নামের শুরুর "৯৯৯ — " অংশ বাদ (নম্বর কার্ডে আলাদা বড় করে দেখানো হয়)
const cleanName = (n) => (n || "").replace(/^[\d০-৯]+\s*[—–-]\s*/, "");
const telHref = (c) => "tel:" + c.trim().replace(/[^\d+]/g, "");

function callButton(contact, emergency) {
  return React.createElement("a", {
    href: telHref(contact),
    style: {
      display: "block", marginTop: "8px", textAlign: "center", textDecoration: "none", minHeight: "20px", padding: "9px 6px",
      borderRadius: "12px", fontSize: "14px", fontWeight: 700, color: "#fff",
      background: emergency ? "#C0392B" : "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))",
    },
  }, "📞 কল");
}

function HotlineCard(e, emergency) {
  const phone = isPhone(e.contact);
  return React.createElement(
    "div", {
      key: e.id,
      style: {
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px", borderRadius: "16px",
        border: "1px solid " + (emergency ? "#E5A29A" : "#D3E0D9"), background: emergency ? "#FFF1EE" : "#fff",
        boxShadow: "0 2px 8px rgba(14,75,67,0.07)",
      },
    },
    React.createElement(
      "div", null,
      !emergency && React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", fontWeight: 600 } }, CARE_ESCALATION_TYPE_LABELS[e.type] || ""),
      React.createElement("div", { style: { fontSize: "26px", fontWeight: 800, color: emergency ? "#C0392B" : "var(--hs-primary, #0E4B43)", lineHeight: 1.2 } }, e.contact),
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, marginTop: "2px" } }, cleanName(e.name)),
      e.notes && React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "4px" } }, e.notes)
    ),
    phone && callButton(e.contact, emergency)
  );
}

function OnlineRow(e) {
  return React.createElement(
    "div", { key: e.id, style: { border: "1px solid #D3E0D9", borderRadius: "14px", padding: "10px", background: "#fff" } },
    React.createElement("div", { style: { fontWeight: 600 } }, e.name),
    isDomain(e.contact)
      ? React.createElement("a", { href: "https://" + e.contact.trim(), target: "_blank", rel: "noopener noreferrer", style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)" } }, e.contact)
      : React.createElement("div", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", marginTop: "2px" } }, e.contact),
    e.notes && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", marginTop: "4px" } }, e.notes)
  );
}

const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };

export function CareEscalationDirectory() {
  const [entries, setEntries] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    listCareEscalationDirectory()
      .then(setEntries)
      .catch((e) => setLoadErr(e.message || String(e)));
  }, []);

  if (loadErr) return ErrorBox(loadErr);
  if (entries === null) {
    return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "তালিকা লোড হচ্ছে...");
  }
  if (entries.length === 0) {
    return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "এখনো কোনো entry নেই।");
  }

  const order = Object.keys(CARE_ESCALATION_TYPE_LABELS);
  const rank = (e) => { const i = order.indexOf(e.type); return i < 0 ? 99 : i; };
  const sorted = entries.slice().sort((a, b) => rank(a) - rank(b));
  const emergency = sorted.filter((e) => e.type === EMERGENCY_TYPE);
  const online = sorted.filter((e) => ONLINE_TYPES.includes(e.type));
  const hotlines = sorted.filter((e) => e.type !== EMERGENCY_TYPE && !ONLINE_TYPES.includes(e.type));

  const heading = (text) => React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)", margin: "14px 0 8px" } }, text);

  return React.createElement(
    "div", null,
    React.createElement("p", { style: { fontSize: "14px", color: "#5F716C", margin: "0 0 4px" } },
      "Verified হেল্পলাইন — সব পরিবার একই তালিকা শেয়ার করে।"),
    emergency.length > 0 && heading("🚨 জরুরি (পুলিশ/ফায়ার/অ্যাম্বুলেন্স)"),
    emergency.length > 0 && React.createElement("div", { style: gridStyle }, ...emergency.map((e) => HotlineCard(e, true))),
    hotlines.length > 0 && heading("📞 হটলাইন"),
    hotlines.length > 0 && React.createElement("div", { style: gridStyle }, ...hotlines.map((e) => HotlineCard(e, false))),
    online.length > 0 && React.createElement("div", { style: { marginTop: "14px" } },
      React.createElement(CollapsibleSection, {
        title: "💻 অনলাইন ডাক্তার/ফার্মেসি (ফি-ভিত্তিক)", defaultOpen: false,
        children: React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, ...online.map(OnlineRow)),
      }))
  );
}
