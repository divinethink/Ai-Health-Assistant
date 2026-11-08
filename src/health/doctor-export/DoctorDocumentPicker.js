// "ডাক্তারকে দেখানোর নথি" — ধাপ ৩ (owner-approved, ২০২৬-১১-০৮)।
// সদস্যের জমা নথি থেকে যেগুলো দেখাতে চান বেছে নিয়ে তালিকা+লিংক শেয়ার/কপি করা যায়।
// শুধু read (listDocuments() নিজেই hasAccess()-গেটেড) — কোনো schema/rules বদল নেই।
// লিংকগুলো Cloudinary-র অনুমান-অযোগ্য URL; যার কাছে পাঠাবেন সে-ই খুলতে পারবে —
// তাই UI-তে সতর্কবার্তা আছে।

import { ErrorBox, SuccessBox } from "../../shared/ui.js";
import { listDocuments, DOC_TYPE_LABELS } from "../documents/documentsData.js";

const { useState, useEffect, useMemo } = React;

function actionBtn(label, onClick, disabled, primary) {
  return React.createElement("button", {
    onClick, disabled,
    style: {
      padding: "10px 14px", borderRadius: "14px", fontWeight: 600, fontSize: "14px", marginRight: "8px", marginTop: "8px", cursor: disabled ? "default" : "pointer",
      border: primary ? "none" : "1px solid #0E4B43",
      background: disabled ? "#C9D6D1" : (primary ? "#0E4B43" : "#fff"),
      color: disabled ? "#fff" : (primary ? "#fff" : "#0E4B43"),
    },
  }, label);
}

export function buildShareText(memberName, docs) {
  const lines = ["স্বাস্থ্য-নথি" + (memberName ? " — " + memberName : "") + ":", ""];
  docs.forEach((d, i) => {
    lines.push((i + 1) + ". " + (DOC_TYPE_LABELS[d.docType] || d.docType) + (d.date ? " (" + d.date + ")" : "") + (d.source ? " — " + d.source : ""));
    lines.push(d.cloudinaryUrl);
  });
  return lines.join("\n");
}

export function DoctorDocumentPicker({ familyId, targetMemberId, memberName }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setDocs(null); setErr(null); setPicked({}); setMsg(null);
    listDocuments(familyId, targetMemberId)
      .then((all) => setDocs(all.filter((d) => d.status === "ready" && d.cloudinaryUrl)))
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের নথি দেখার অনুমতি আপনার নেই।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId]);

  const chosen = useMemo(() => (docs || []).filter((d) => picked[d.id]), [docs, picked]);

  const toggle = (id) => { setMsg(null); setPicked((p) => ({ ...p, [id]: !p[id] })); };
  const toggleAll = () => {
    setMsg(null);
    const all = docs.length > 0 && chosen.length === docs.length;
    const next = {};
    if (!all) docs.forEach((d) => { next[d.id] = true; });
    setPicked(next);
  };

  const copy = async () => {
    setErr(null);
    try {
      await navigator.clipboard.writeText(buildShareText(memberName, chosen));
      setMsg("তালিকা ও লিংক কপি হয়েছে — যেকোনো মেসেজ/ইমেইলে paste করুন।");
    } catch (e) {
      setErr("কপি করা যায়নি — ব্রাউজারের অনুমতি দিন বা “শেয়ার” ব্যবহার করুন।");
    }
  };

  const share = async () => {
    setErr(null);
    try {
      await navigator.share({ title: "স্বাস্থ্য-নথি", text: buildShareText(memberName, chosen) });
    } catch (e) {
      if (e && e.name === "AbortError") return; // ব্যবহারকারী নিজে বাতিল করেছেন
      setErr("শেয়ার করা যায়নি — “লিংক কপি করুন” ব্যবহার করুন।");
    }
  };

  const box = { border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", padding: "12px", marginTop: "10px", background: "#fff" };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  let body;
  if (err && !docs) body = ErrorBox(err);
  else if (!docs) body = React.createElement("p", { style: { color: "#5F716C", fontSize: "14px", margin: 0 } }, "লোড হচ্ছে...");
  else if (docs.length === 0) body = React.createElement("p", { style: { color: "#5F716C", fontSize: "14px", margin: 0 } }, "জমা নথি নেই — আগে “জমা নথি” ট্যাবে নথি যোগ করুন।");
  else body = React.createElement(
    React.Fragment, null,
    React.createElement("button", {
      onClick: toggleAll,
      style: { border: "none", background: "none", color: "#0E4B43", fontWeight: 600, fontSize: "14px", padding: "0 0 6px", cursor: "pointer" },
    }, chosen.length === docs.length ? "সব বাদ দিন" : "সব বাছুন"),
    docs.map((d) => React.createElement(
      "label", { key: d.id, style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderTop: "1px solid #EAF1ED", fontSize: "14px", cursor: "pointer" } },
      React.createElement("input", { type: "checkbox", checked: !!picked[d.id], onChange: () => toggle(d.id), style: { width: "20px", height: "20px" } }),
      React.createElement("span", { style: { flex: 1, minWidth: 0 } },
        React.createElement("b", null, DOC_TYPE_LABELS[d.docType] || d.docType),
        React.createElement("span", { style: { color: "#5F716C" } }, (d.date ? " — " + d.date : "") + (d.source ? " (" + d.source + ")" : "")),
        React.createElement("div", { style: { color: "#3E4E49", wordBreak: "break-all" } }, d.fileName))
    )),
    React.createElement("div", { style: { fontSize: "14px", color: "#8A5A00", marginTop: "8px" } },
      "⚠️ লিংক যার কাছে যাবে সে-ই নথি খুলতে পারবে — শুধু বিশ্বস্ত ডাক্তার/ব্যক্তিকে পাঠান।"),
    canShare && actionBtn("📤 শেয়ার (" + chosen.length + ")", share, chosen.length === 0, true),
    actionBtn("📋 লিংক কপি করুন", copy, chosen.length === 0, !canShare),
    msg && SuccessBox(msg),
    err && ErrorBox(err)
  );

  return React.createElement(
    "div", { style: box },
    React.createElement("div", { style: { fontWeight: 600, fontSize: "14px", marginBottom: "6px" } }, "ডাক্তারকে দেখানোর নথি বেছে নিন"),
    body
  );
}
