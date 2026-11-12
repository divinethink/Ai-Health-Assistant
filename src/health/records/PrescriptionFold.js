// ওষুধ-পিলের নিচে ভাঁজ করা "📄 প্রেসক্রিপশন (n)" — জমা প্রেসক্রিপশন-নথি (তারিখ, ডাক্তার, নাম)।
// শুধু বিদ্যমান DocumentList (docType = prescription) দেখায়; ডেটা/schema অপরিবর্তিত।

import { Icon } from "../../shared/icons.js";
import { useMemberHealth } from "./useMemberHealth.js";
import { DocumentList } from "../documents/DocumentList.js";

const { useState } = React;
const h = React.createElement;
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);

export function PrescriptionFold({ familyId, callerMemberId, selectedMemberId, count, refreshTick, onDeleted }) {
  const [open, setOpen] = useState(false);
  const { records } = useMemberHealth(familyId, selectedMemberId);
  const medsByDoc = {};
  (records || []).forEach((r) => { if (r.resourceType === "medicationStatement" && r.prescriptionDocId && r.genericName) (medsByDoc[r.prescriptionDocId] = medsByDoc[r.prescriptionDocId] || []).push(r.genericName); });
  return h("div", { style: { marginTop: "14px" } },
    h("button", {
      onClick: () => setOpen((o) => !o), "aria-expanded": open,
      style: { width: "100%", minHeight: "48px", padding: "10px 14px", borderRadius: "14px", border: "1px solid #D3E0D9", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" },
    }, h("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, Icon("file", { size: 17 }), "প্রেসক্রিপশন" + (count == null ? "" : " (" + bn(count) + ")")), h("span", { "aria-hidden": "true", style: { display: "flex" } }, Icon(open ? "up" : "down", { size: 18 }))),
    open && h(DocumentList, {
      familyId, targetMemberId: selectedMemberId, callerMemberId, refreshTick, onDeleted,
      onlyType: "prescription", medsByDoc, emptyText: "এখনো প্রেসক্রিপশন নেই — ＋ যোগ করুন",
    }));
}
