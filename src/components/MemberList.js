// পরিবারের সদস্য-তালিকা — Member Roster সবার জন্য open (Architecture Plan
// §3.4.3, grant ছাড়াই basic identity visible), শুধু Key-reveal Admin-only।
// প্রতি non-self/non-structural row-এ AccessGrantButton (Take-Access, §11.1)।
// app.js থেকে split (Component-Split — অংশ A) + এই থ্রেডে AccessGrant UI যোগ।

import { ErrorBox } from "../shared/ui.js";
import { listMembers, fetchMemberKey } from "../legacy/familyIdentity.js";
import { listOutgoingGrants, requestAccess, cancelPendingRequest, cancelApprovedGrant } from "../legacy/accessGrants.js";
import { AccessGrantButton } from "./AccessGrantButton.js";

const { useState, useEffect, useCallback } = React;

export function MemberList({ familyId, isAdmin, myMemberId }) {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState(null);
  const [revealKey, setRevealKey] = useState({}); // memberId -> key|"loading"
  const [grants, setGrants] = useState({}); // granterId(targetMemberId) -> outgoing grant doc
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    listMembers(familyId).then(setMembers).catch((e) => setErr(e.message || String(e)));
    if (myMemberId) {
      listOutgoingGrants(familyId, myMemberId).then(setGrants).catch(() => {});
    }
  }, [familyId, myMemberId]);

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

  const doGrantAction = useCallback(async (fn, targetId) => {
    setBusyId(targetId);
    try { await fn(); reload(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyId(null); }
  }, [reload]);

  if (err) return ErrorBox(err);
  if (!members) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");

  const myName = (members.find((m) => m.id === myMemberId) || {}).name;

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "পরিবারের সদস্য"),
    members.map((m) => {
      const isSelf = m.id === myMemberId;
      // structural access: Admin-caller-এর সবার সাথে এমনিতেই full access —
      // তাই বাটন দেখানো হয় না। Parent-Child(<18) structural exception এই
      // ধাপে scope-বহির্ভূত (guardianMemberIds UI এখনো implement হয়নি)।
      const showGrantButton = !isAdmin && !isSelf;
      const grant = grants[m.id];
      const status = !grant ? "none" : (grant.status === "approved" ? "approved" : (grant.status === "pending" ? "pending-outgoing" : "none"));

      return React.createElement(
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
        ),
        showGrantButton && React.createElement(AccessGrantButton, {
          status, busy: busyId === m.id,
          onRequest: () => doGrantAction(() => requestAccess(familyId, m.id, myMemberId, myName), m.id),
          onCancelPending: () => doGrantAction(() => cancelPendingRequest(familyId, m.id, myMemberId), m.id),
          onCancelApproved: () => doGrantAction(() => cancelApprovedGrant(familyId, m.id, myMemberId, myMemberId, myName), m.id),
        })
      );
    })
  );
}
