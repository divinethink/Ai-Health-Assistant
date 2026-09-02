// পরিবারের সদস্য-তালিকা (Admin-এর জন্য key-reveal সহ)। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { ErrorBox } from "../shared/ui.js";
import { listMembers, fetchMemberKey } from "../legacy/familyIdentity.js";

const { useState, useEffect, useCallback } = React;

export function MemberList({ familyId, isAdmin }) {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState(null);
  const [revealKey, setRevealKey] = useState({}); // memberId -> key|"loading"

  const reload = useCallback(() => {
    listMembers(familyId).then(setMembers).catch((e) => setErr(e.message || String(e)));
  }, [familyId]);

  useEffect(() => { reload(); }, [reload]);

  const onReveal = useCallback(async (memberId) => {
    setRevealKey((prev) => ({ ...prev, [memberId]: "loading" }));
    try {
      const key = await fetchMemberKey(familyId, memberId);
      setRevealKey((prev) => ({ ...prev, [memberId]: key || "(পাওয়া যায়নি)" }));
    } catch (e) {
      setRevealKey((prev) => ({ ...prev, [memberId]: "ত্রুটি: " + (e.message || e) }));
    }
  }, [familyId]);

  if (err) return ErrorBox(err);
  if (!members) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "পরিবারের সদস্য"),
    members.map((m) =>
      React.createElement(
        "div", { key: m.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null,
          React.createElement("b", null, m.name),
          " — ", m.role === "admin" ? "Admin" : (m.role || "self-managing"),
          " — ", (m.ownerUids && m.ownerUids.length > 0) ? "claim হয়েছে" : "claim বাকি"
        ),
        isAdmin && m.role !== "admin" && React.createElement(
          "div", { style: { marginTop: "4px" } },
          revealKey[m.id]
            ? React.createElement("span", { style: { fontFamily: "monospace" } }, revealKey[m.id])
            : React.createElement(
                "button", {
                  onClick: () => onReveal(m.id),
                  style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", cursor: "pointer" },
                },
                "Key দেখান"
              )
        )
      )
    )
  );
}
