// পরিবারের সদস্য-তালিকা — Member Roster সবার জন্য open (Architecture Plan
// §3.4.3, grant ছাড়াই basic identity visible), শুধু Key-reveal Admin-only।
// প্রতি non-self/non-structural row-এ AccessGrantButton (Take-Access, §11.1)।
// এই থ্রেডে যোগ হলো: Admin-only ✎ আইকন (RelationshipModal, §11.5),
// relationshipLabel display, guardian-caller-এর জন্য grant-button suppress,
// এবং ১৮+ revocable-flip check (একবার, member-list load হওয়ার পর)।

import { ErrorBox } from "../shared/ui.js";
import { listMembers, fetchMemberKey } from "../legacy/familyIdentity.js";
import { listOutgoingGrants, requestAccess, cancelPendingRequest, cancelApprovedGrant, checkAndFlip18Transition } from "../legacy/accessGrants.js";
import { AccessGrantButton } from "./AccessGrantButton.js";
import { RelationshipModal, RELATIONSHIP_OPTIONS } from "./RelationshipModal.js";

const { useState, useEffect, useCallback, useRef } = React;

const RELATIONSHIP_LABEL_MAP = Object.fromEntries(RELATIONSHIP_OPTIONS);

export function MemberList({ familyId, isAdmin, myMemberId }) {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState(null);
  const [revealKey, setRevealKey] = useState({}); // memberId -> key|"loading"
  const [grants, setGrants] = useState({}); // granterId(targetMemberId) -> outgoing grant doc
  const [busyId, setBusyId] = useState(null);
  const [relModalTarget, setRelModalTarget] = useState(null); // Member | null
  const did18CheckRef = useRef(false);

  const reload = useCallback(() => {
    listMembers(familyId).then(setMembers).catch((e) => setErr(e.message || String(e)));
    if (myMemberId) {
      listOutgoingGrants(familyId, myMemberId).then(setGrants).catch(() => {});
    }
  }, [familyId, myMemberId]);

  useEffect(() => { reload(); }, [reload]);

  // ১৮+ soft-notify transition check — একবার, member-list প্রথমবার load হওয়ার পর
  // (roadmap §3.6)। rules-এ revocable-flip শুধু Admin-কেই অনুমতি দেয়, তাই
  // non-admin session-এ এটা চালানো হয় না (নাহলে প্রতি reload-এ নিষ্ফল
  // permission-denied read হতো)।
  useEffect(() => {
    if (members && isAdmin && !did18CheckRef.current) {
      did18CheckRef.current = true;
      checkAndFlip18Transition(familyId, members).catch(() => {});
    }
  }, [members, familyId, isAdmin]);

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
      const isGuardianOfThis = Array.isArray(m.guardianMemberIds) && m.guardianMemberIds.includes(myMemberId);
      // structural access (Admin, বা এই সদস্যের guardian) থাকলে Take-Access বাটন
      // দেখানো হয় না — দেখালে ভুলবশত ক্লিকে existing approved structural grant
      // pending-এ re-request হয়ে যেতে পারত (rules-এর re-request branch শুধু
      // status-field-ই বদলায়, তাই এই suppress না করলে ঝুঁকি ছিল)।
      const showGrantButton = !isAdmin && !isSelf && !isGuardianOfThis;
      const grant = grants[m.id];
      const status = !grant ? "none" : (grant.status === "approved" ? "approved" : (grant.status === "pending" ? "pending-outgoing" : "none"));
      const relLabel = m.relationshipLabel ? RELATIONSHIP_LABEL_MAP[m.relationshipLabel] : null;

      return React.createElement(
        "div", { key: m.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
          React.createElement("span", null,
            React.createElement("b", null, m.name),
            " — ", m.role === "admin" ? "Admin" : (m.role || "self-managing"),
            " — ", (m.ownerUids && m.ownerUids.length > 0) ? "claim হয়েছে" : "claim বাকি",
            relLabel ? " — " + relLabel : ""
          ),
          isAdmin && !isSelf && React.createElement("button", {
            onClick: () => setRelModalTarget(m),
            title: "সম্পর্ক ও অভিভাবকত্ব এডিট করুন",
            style: {
              marginLeft: "auto", border: "none", background: "none", cursor: "pointer",
              fontSize: "14px", color: "#0E4B43", padding: "2px 6px",
            },
          }, "✎")
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
    }),
    relModalTarget && React.createElement(RelationshipModal, {
      familyId, targetMember: relModalTarget, allMembers: members, myMemberId,
      onClose: () => setRelModalTarget(null),
      onSaved: reload,
    })
  );
}
