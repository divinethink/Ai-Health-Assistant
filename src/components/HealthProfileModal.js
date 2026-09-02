// HealthProfileModal — Member-এর static Health Profile fields (নাম, জন্ম-তারিখ,
// লিঙ্গ, রক্তের গ্রুপ) edit করার modal। Architecture Plan Part A §2 (Member
// schema, bloodGroup) ও roadmap §6 অনুযায়ী। height/weight ইচ্ছাকৃতভাবে এখানে
// নেই — Architecture Plan Part C §10.2 নীতি অনুযায়ী ওগুলো Observation
// health-record (নিচের Health Records section) হিসেবেই যোগ করতে হবে, কারণ
// সময়ের সাথে বদলায় ও trend-tracking-যোগ্য।
//
// Trigger: MemberList-এ নিজের row-এ (self) বা Admin-এর জন্য যেকোনো row-এ।
// Permission: firestore.rules-এর members/{memberId} update rule অনুযায়ী
// self (ownerUids) বা Admin — কোনো নতুন rule লাগেনি (RelationshipModal-এর
// modal-shell pattern reuse করা হয়েছে)।

import { Card, ErrorBox, SelectField, DateField } from "../shared/ui.js";
import { updateMemberProfile } from "../legacy/familyIdentity.js";

const { useState, useCallback } = React;

const SEX_OPTIONS = [["male", "পুরুষ"], ["female", "মহিলা"]];
const BLOOD_GROUP_OPTIONS = [
  ["", "অজানা"], ["A+", "A+"], ["A-", "A-"], ["B+", "B+"], ["B-", "B-"],
  ["AB+", "AB+"], ["AB-", "AB-"], ["O+", "O+"], ["O-", "O-"],
];

export function HealthProfileModal({ familyId, targetMember, onClose, onSaved }) {
  const [name, setName] = useState(targetMember.name || "");
  const [dob, setDob] = useState(targetMember.dob || "");
  const [sex, setSex] = useState(targetMember.sex || "male");
  const [bloodGroup, setBloodGroup] = useState(targetMember.bloodGroup || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      await updateMemberProfile(familyId, targetMember.id, { name, dob, sex, bloodGroup });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMember, name, dob, sex, bloodGroup, onSaved, onClose]);

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
        React.createElement("h3", { style: { fontSize: "16px", color: "#0E4B43" } }, "Health Profile — " + targetMember.name),

        React.createElement(
          "div", { style: { marginTop: "10px" } },
          React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "নাম"),
          React.createElement("input", {
            type: "text", value: name, onChange: (e) => setName(e.target.value),
            style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
          })
        ),
        DateField("জন্ম-তারিখ", dob, setDob),
        SelectField("লিঙ্গ", sex, setSex, SEX_OPTIONS),
        SelectField("রক্তের গ্রুপ", bloodGroup, setBloodGroup, BLOOD_GROUP_OPTIONS),

        React.createElement(
          "p", { style: { color: "#888", fontSize: "12px", marginTop: "10px" } },
          "উচ্চতা/ওজন এখানে নেই — সেগুলো নিচের Health Records-এ Observation হিসেবে যোগ করুন (সময়ের সাথে বদলায় বলে trend হিসেবে রাখা হয়)।"
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
