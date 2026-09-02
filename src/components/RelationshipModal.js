// RelationshipModal — relationshipLabel (cosmetic dropdown) ও guardianMemberIds
// (access-control-critical multi-select) edit করার Admin-only modal।
// Architecture Plan §3.1.1/§11.5 অনুযায়ী। MemberListSection-এর ✎ আইকন থেকে খোলে।

import { db } from "../legacy/firebaseConfig.js";
import { Card, ErrorBox } from "../shared/ui.js";
import { createStructuralGrant, cancelStructuralGrant } from "../legacy/accessGrants.js";

const { useState, useCallback } = React;

export const RELATIONSHIP_OPTIONS = [
  ["", "— নির্বাচন করুন —"],
  ["husband", "স্বামী"], ["wife", "স্ত্রী"], ["father", "বাবা"], ["mother", "মা"],
  ["son", "ছেলে"], ["daughter", "মেয়ে"], ["sibling", "ভাই/বোন"],
  ["grandparent", "দাদা/দাদি/নানা/নানি"], ["grandchild", "নাতি/নাতনি"],
  ["uncle-aunt", "চাচা/চাচী/মামা/খালা"], ["other", "অন্যান্য"],
];

function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function RelationshipModal({ familyId, targetMember, allMembers, myMemberId, onClose, onSaved }) {
  const [label, setLabel] = useState(targetMember.relationshipLabel || "");
  const [guardians, setGuardians] = useState(new Set(targetMember.guardianMemberIds || []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const toggleGuardian = useCallback((id) => {
    setGuardians((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      const newGuardianIds = Array.from(guardians);
      const oldGuardianIds = targetMember.guardianMemberIds || [];

      await db.collection("families").doc(familyId).collection("members").doc(targetMember.id)
        .update({ relationshipLabel: label || null, guardianMemberIds: newGuardianIds });

      const age = calcAge(targetMember.dob);
      if (age !== null && age < 18) {
        const added = newGuardianIds.filter((id) => !oldGuardianIds.includes(id));
        const removed = oldGuardianIds.filter((id) => !newGuardianIds.includes(id));
        for (const gId of added) await createStructuralGrant(familyId, targetMember.id, gId);
        for (const gId of removed) await cancelStructuralGrant(familyId, targetMember.id, gId, myMemberId);
      }

      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMember, label, guardians, myMemberId, onSaved, onClose]);

  return React.createElement(
    "div", {
      style: {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50, padding: "16px",
      },
    },
    Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h3", { style: { fontSize: "16px", color: "#0E4B43" } },
          targetMember.name + "-এর সম্পর্ক ও অভিভাবকত্ব"),

        React.createElement("label", { style: { fontSize: "12px", color: "#555", marginTop: "10px", display: "block" } }, "সম্পর্ক"),
        React.createElement(
          "select", {
            value: label, onChange: (e) => setLabel(e.target.value),
            style: { width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", fontSize: "13px" },
          },
          RELATIONSHIP_OPTIONS.map(([v, l]) => React.createElement("option", { key: v, value: v }, l))
        ),

        React.createElement("label", { style: { fontSize: "12px", color: "#555", marginTop: "14px", display: "block" } }, "অভিভাবক (guardian)"),
        React.createElement(
          "div", { style: { marginTop: "4px", maxHeight: "180px", overflowY: "auto" } },
          allMembers.filter((m) => m.id !== targetMember.id).map((m) =>
            React.createElement(
              "label", { key: m.id, style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: "4px 0" } },
              React.createElement("input", {
                type: "checkbox", checked: guardians.has(m.id),
                onChange: () => toggleGuardian(m.id),
              }),
              m.name
            )
          )
        ),

        err && ErrorBox(err),

        React.createElement(
          "div", { style: { display: "flex", gap: "8px", marginTop: "16px" } },
          React.createElement("button", {
            onClick: save, disabled: busy,
            style: {
              flex: 1, padding: "10px", borderRadius: "6px", border: "none",
              background: "#0E4B43", color: "#fff", cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1, fontSize: "13px",
            },
          }, busy ? "সংরক্ষণ হচ্ছে..." : "Save"),
          React.createElement("button", {
            onClick: onClose, disabled: busy,
            style: {
              flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #CBD5E1",
              background: "#fff", cursor: "pointer", fontSize: "13px",
            },
          }, "Cancel")
        )
      )
    )
  );
}
