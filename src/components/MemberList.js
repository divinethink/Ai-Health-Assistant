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
  if (!members) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য-তালিকা লোড হচ্ছে...");

  const iconBtn = (label, title, onClick) => React.createElement("button", {
    onClick, title, "aria-label": title,
    style: { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-chip-bg, #E4F0E9)", cursor: "pointer", fontSize: "16px", color: "var(--hs-primary, #0E4B43)" },
  }, label);

  const toggleChip = (label, on, disabled, onClick) => React.createElement("button", {
    onClick, disabled,
    style: {
      flex: 1, minHeight: "42px", padding: "6px 8px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: disabled ? "default" : "pointer",
      border: "1.5px solid " + (on ? "var(--hs-primary, #0E4B43)" : "#C3D2CA"),
      background: on ? "var(--hs-primary, #0E4B43)" : "#fff", color: on ? "#fff" : "#4B5C57",
    },
  }, (on ? "✓ " : "") + label);

  return React.createElement(
    "div", { style: { marginTop: "4px" } },
    myMemberId && React.createElement(
      "p", { style: { fontSize: "14px", color: "var(--hs-muted, #5F716C)", margin: "0 0 12px" } },
      "প্রতিটা সদস্য আপনার প্রোফাইলে কী করতে পারবে, নিচে ঠিক করুন।"
    ),
    members.map((m) => {
      const isSelf = m.id === myMemberId;
      // structural access (Admin — সবার প্রোফাইলে স্বয়ংক্রিয় access, বা এই
      // সদস্য আমার guardian — অর্থাৎ আমি m.guardianMemberIds-এ আছি) থাকলে
      // sharing-toggle দেখানো হয় না, কারণ সেই access আগে থেকেই স্বয়ংক্রিয়/
      // non-revocable (Admin/Parent-Child<18, roadmap §3.1.1)।
      const isMyGuardian = Array.isArray(m.guardianMemberIds) && m.guardianMemberIds.includes(myMemberId);
      const showShareControls = !isSelf && myMemberId && m.role !== "admin" && !isMyGuardian;
      const relLabel = m.relationshipLabel ? RELATIONSHIP_LABEL_MAP[m.relationshipLabel] : null;
      const share = myShares[m.id] || { read: false, write: false };
      const roleText = m.role === "admin" ? "Admin" : (m.role === "guardian-managed" ? "অভিভাবক-পরিচালিত" : "সাধারণ সদস্য");
      const statusText = m.googleUid ? "✅ claim হয়েছে" : (m.email ? "⏳ claim বাকি (ইমেইল দেওয়া আছে)" : "👤 no-account (অভিভাবক-পরিচালিত)");
      const initial = ((m.name || "?").trim()[0] || "?").toUpperCase();

      return React.createElement(
        "div", { key: m.id, style: { padding: "14px", marginBottom: "10px", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "16px", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 8px rgba(14,75,67,0.07)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
          React.createElement("div", { style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", fontWeight: 800, color: "var(--hs-primary-contrast, #fff)", background: "var(--hs-primary, #0E4B43)" } }, initial),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              React.createElement("b", { style: { fontSize: "15px" } }, m.name + (isSelf ? " (আপনি)" : "")),
              React.createElement("span", { style: { fontSize: "12px", fontWeight: 700, padding: "2px 9px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-primary, #0E4B43)" } }, roleText),
              relLabel && React.createElement("span", { style: { fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, relLabel)),
            React.createElement("div", { style: { fontSize: "13px", color: "var(--hs-muted, #5F716C)", marginTop: "2px" } }, statusText)),
          (isSelf || isAdmin) && iconBtn("🩺", "Health Profile এডিট করুন", () => setProfileModalTarget(m)),
          isAdmin && !isSelf && iconBtn("✎", "সম্পর্ক ও অভিভাবকত্ব এডিট করুন", () => setRelModalTarget(m))
        ),
        showShareControls
          ? React.createElement(
              "div", { style: { marginTop: "12px", display: "flex", gap: "8px", opacity: busyId === m.id ? 0.5 : 1 } },
              toggleChip("👁 আমার প্রোফাইল দেখতে পারবে", !!share.read, busyId === m.id, () => onToggleShare(m.id, "read", !share.read)),
              toggleChip("✏️ এডিট করতে পারবে", !!share.write, busyId === m.id, () => onToggleShare(m.id, "write", !share.write))
            )
          // Architecture Part A §3.1 / Part C §11.1: structural-access সদস্যের row-এ
          // toggle না দেখিয়ে শুধু informational label।
          : !isSelf && (m.role === "admin" || isMyGuardian) && React.createElement(
              "div", { style: { marginTop: "10px", fontSize: "13px", color: "#6B7A76" } },
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
