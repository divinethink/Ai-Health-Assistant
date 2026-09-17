// পরিবারের সদস্য-তালিকা — Member Roster সবার জন্য open (Architecture Plan
// §3.4.3, grant ছাড়াই basic identity visible), শুধু Key-reveal Admin-only।
// এই থ্রেডে যোগ হলো: Admin-only ✎ আইকন (RelationshipModal, §11.5),
// relationshipLabel display, এবং ১৮+ revocable-flip check (একবার,
// member-list load হওয়ার পর)।
//
// Owner-Controlled Profile Permission (amendment item ২) — আগের
// request→approve Take-Access বাটন (AccessGrantButton) সরিয়ে প্রতিটা
// non-self/non-admin row-এ সরাসরি Read/Write checkbox যোগ হলো: এই checkbox
// দুটো নিয়ন্ত্রণ করে "এই row-এর সদস্য (m) আমার (myMemberId) প্রোফাইলে কী
// access পাবেন" — direct owner-write, কোনো approval-wait নেই। Structural
// access (Admin, Parent-Child<18) অপরিবর্তিত/স্বয়ংক্রিয় থাকায় এখানে দেখানো
// হয় না।

import { ErrorBox } from "../shared/ui.js";
import { listMembers } from "../legacy/familyIdentity.js";
import { checkAndFlip18Transition } from "../legacy/accessGrants.js";
import { listMySharesGiven, setProfileShare } from "../legacy/profileShares.js";
import { RelationshipModal, RELATIONSHIP_OPTIONS } from "./RelationshipModal.js";
import { HealthProfileModal } from "./HealthProfileModal.js";

const { useState, useEffect, useCallback, useRef } = React;

const RELATIONSHIP_LABEL_MAP = Object.fromEntries(RELATIONSHIP_OPTIONS);

export function MemberList({ familyId, isAdmin, myMemberId }) {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState(null);
  const [myShares, setMyShares] = useState({}); // granteeId -> { read, write } — আমি কাকে কী দিয়েছি
  const [busyId, setBusyId] = useState(null);
  const [relModalTarget, setRelModalTarget] = useState(null); // Member | null
  const [profileModalTarget, setProfileModalTarget] = useState(null); // Member | null
  const did18CheckRef = useRef(false);

  const reload = useCallback(() => {
    listMembers(familyId).then(setMembers).catch((e) => setErr(e.message || String(e)));
    if (myMemberId) {
      listMySharesGiven(familyId, myMemberId).then(setMyShares).catch(() => {});
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

  const onToggleShare = useCallback(async (granteeId, field, checked) => {
    if (!myMemberId) return;
    setBusyId(granteeId);
    const current = myShares[granteeId] || { read: false, write: false };
    const next = { ...current, [field]: checked };
    // Write ON করলে Read স্বয়ংক্রিয়ভাবে ON (Write without Read অর্থহীন)।
    // Read OFF করলে Write-ও OFF (Write, Read ছাড়া অর্থহীন)।
    if (field === "write" && checked) next.read = true;
    if (field === "read" && !checked) next.write = false;
    try {
      await setProfileShare(familyId, myMemberId, granteeId, next);
      setMyShares((prev) => ({ ...prev, [granteeId]: next }));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }, [familyId, myMemberId, myShares]);

  if (err) return ErrorBox(err);
  if (!members) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "পরিবারের সদস্য"),
    myMemberId && React.createElement(
      "p", { style: { fontSize: "11px", color: "#888", marginTop: "-6px", marginBottom: "8px" } },
      "প্রতিটা সদস্যের পাশে Read/Write টিক দিয়ে আপনার নিজের প্রোফাইলে তার access সরাসরি ঠিক করুন।"
    ),
    members.map((m) => {
      const isSelf = m.id === myMemberId;
      // structural access (Admin — সবার প্রোফাইলে স্বয়ংক্রিয় access, বা এই
      // সদস্য আমার guardian — অর্থাৎ আমি m.guardianMemberIds-এ আছি) থাকলে
      // sharing-checkbox দেখানো হয় না, কারণ সেই access আগে থেকেই স্বয়ংক্রিয়/
      // non-revocable (Admin/Parent-Child<18, roadmap §3.1.1)।
      const isMyGuardian = Array.isArray(m.guardianMemberIds) && m.guardianMemberIds.includes(myMemberId);
      const showShareControls = !isSelf && myMemberId && m.role !== "admin" && !isMyGuardian;
      const relLabel = m.relationshipLabel ? RELATIONSHIP_LABEL_MAP[m.relationshipLabel] : null;
      const share = myShares[m.id] || { read: false, write: false };

      return React.createElement(
        "div", { key: m.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
          React.createElement("span", null,
            React.createElement("b", null, m.name),
            " — ", m.role === "admin" ? "Admin" : (m.role === "guardian-managed" ? "অভিভাবক-পরিচালিত" : "সাধারণ সদস্য"),
            " — ", m.googleUid ? "claim হয়েছে" : (m.email ? "claim বাকি (ইমেইল দেওয়া আছে)" : "no-account (অভিভাবক-পরিচালিত)"),
            relLabel ? " — " + relLabel : ""
          ),
          (isSelf || isAdmin) && React.createElement("button", {
            onClick: () => setProfileModalTarget(m),
            title: "Health Profile এডিট করুন",
            style: {
              marginLeft: "auto", border: "none", background: "none", cursor: "pointer",
              fontSize: "13px", color: "#0E4B43", padding: "2px 6px",
            },
          }, "🩺"),
          isAdmin && !isSelf && React.createElement("button", {
            onClick: () => setRelModalTarget(m),
            title: "সম্পর্ক ও অভিভাবকত্ব এডিট করুন",
            style: {
              border: "none", background: "none", cursor: "pointer",
              fontSize: "14px", color: "#0E4B43", padding: "2px 6px",
            },
          }, "✎")
        ),
        showShareControls
          ? React.createElement(
              "div", { style: { marginTop: "6px", display: "flex", alignItems: "center", gap: "14px", opacity: busyId === m.id ? 0.5 : 1 } },
              React.createElement(
                "label", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" } },
                React.createElement("input", {
                  type: "checkbox", checked: !!share.read, disabled: busyId === m.id,
                  onChange: (e) => onToggleShare(m.id, "read", e.target.checked),
                }),
                "আমার প্রোফাইল Read করতে পারবেন"
              ),
              React.createElement(
                "label", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" } },
                React.createElement("input", {
                  type: "checkbox", checked: !!share.write, disabled: busyId === m.id,
                  onChange: (e) => onToggleShare(m.id, "write", e.target.checked),
                }),
                "Write/Edit করতে পারবেন"
              )
            )
          // Architecture Part A §3.1 / Part C §11.1 অনুযায়ী: structural-access
          // (Admin, বা Parent-Child<18 — এখানে "m আমার guardian" দিক থেকে)
          // সদস্যের row-এ toggle না দেখিয়ে শুধু informational label দেখানো
          // উচিত ছিল, আগে এই স্থানে কিছুই render হতো না (gap-fix, pure UI)।
          : !isSelf && (m.role === "admin" || isMyGuardian) && React.createElement(
              "div", { style: { marginTop: "4px", fontSize: "11px", color: "#8A9A96" } },
              "🔒 সবসময় access আছে (" + (m.role === "admin" ? "Admin" : "অভিভাবক-সম্পর্ক") + ")"
            )
      );
    }),
    relModalTarget && React.createElement(RelationshipModal, {
      familyId, targetMember: relModalTarget, allMembers: members, myMemberId,
      onClose: () => setRelModalTarget(null),
      onSaved: reload,
    }),
    profileModalTarget && React.createElement(HealthProfileModal, {
      familyId, targetMember: profileModalTarget,
      onClose: () => setProfileModalTarget(null),
      onSaved: reload,
    })
  );
}
