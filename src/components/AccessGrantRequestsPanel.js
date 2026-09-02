// আমার (myMemberId = granterId) প্রোফাইলে অন্য সদস্যরা যে access-request
// পাঠিয়েছেন তার panel — DailyTask AccessRequestsModal-এর card-list pattern
// থেকে adapt (Architecture Plan §11.1/§11.2)। এটা Admin-only না — যেকোনো
// সদস্য (তার নিজের প্রোফাইলের জন্য) দেখতে পাবেন।
//
// দুই ভাগ: pending (Accept/Deny) ও ইতিমধ্যে-approved (Cancel Access, §3.5
// "উভয় পক্ষ থেকে cancel" নীতির granter-side অংশ)।

import { ErrorBox } from "../shared/ui.js";
import { listGranterGrants, decideIncomingRequest, cancelApprovedGrant } from "../legacy/accessGrants.js";
import { listMembers } from "../legacy/familyIdentity.js";

const { useState, useEffect, useCallback } = React;

export function AccessGrantRequestsPanel({ familyId, myMemberId, myName }) {
  const [grants, setGrants] = useState(null);
  const [names, setNames] = useState({});
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    if (!myMemberId) return;
    listGranterGrants(familyId, myMemberId).then(setGrants).catch((e) => setErr(e.message || String(e)));
    listMembers(familyId).then((list) => {
      const map = {};
      list.forEach((m) => { map[m.id] = m.name; });
      setNames(map);
    }).catch(() => {});
  }, [familyId, myMemberId]);

  useEffect(() => { reload(); }, [reload]);

  const decide = useCallback(async (granteeId, decision) => {
    setBusyId(granteeId);
    try { await decideIncomingRequest(familyId, myMemberId, granteeId, decision, myName); reload(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyId(null); }
  }, [familyId, myMemberId, myName, reload]);

  const cancelApproved = useCallback(async (granteeId) => {
    setBusyId(granteeId);
    try { await cancelApprovedGrant(familyId, myMemberId, granteeId, myMemberId, myName); reload(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyId(null); }
  }, [familyId, myMemberId, myName, reload]);

  if (err) return ErrorBox(err);
  if (!grants) return null;

  const pending = grants.filter((g) => g.status === "pending");
  const approved = grants.filter((g) => g.status === "approved");
  if (pending.length === 0 && approved.length === 0) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "আপনার প্রোফাইলে Access-অনুরোধ"),
    pending.map((g) =>
      React.createElement(
        "div", { key: g.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("span", null, (names[g.granteeId] || g.granteeId.slice(0, 8) + "…") + " — pending"),
        React.createElement(
          "div", { style: { display: "flex", gap: "6px" } },
          React.createElement("button", {
            onClick: () => decide(g.granteeId, "approved"), disabled: busyId === g.granteeId,
            style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff", cursor: "pointer" },
          }, "Accept"),
          React.createElement("button", {
            onClick: () => decide(g.granteeId, "denied"), disabled: busyId === g.granteeId,
            style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
          }, "Deny")
        )
      )
    ),
    approved.map((g) =>
      React.createElement(
        "div", { key: g.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("span", null, (names[g.granteeId] || g.granteeId.slice(0, 8) + "…") + " — access দেওয়া আছে"),
        React.createElement("button", {
          onClick: () => cancelApproved(g.granteeId), disabled: busyId === g.granteeId,
          style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
        }, "Cancel Access")
      )
    )
  );
}
