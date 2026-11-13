// GoogleSignInGate — একক Google Sign-in ফ্লো (Architecture Part A §3.0)।
// EntryScreen.js + CreateOwnProfile.js + JoinRequestGate.js প্রতিস্থাপন করে।
// DailyTask app-এর GoogleSignInGate.jsx প্যাটার্ন adapt (createElement-style,
// health app-এর বিদ্যমান convention অনুযায়ী, JSX না)।
//
// দুই ব্যবহার-মোড:
//  ক) স্বাভাবিক sign-in/family-create (uid==null → বাটন ক্লিকে popup;
//     uid থাকলেও familyId মেলেনি → auto-check, কোনো দ্বিতীয় popup লাগে না)
//  খ) Invite-Link join (inviteFamilyId/inviteToken prop দেওয়া থাকলে) —
//     no-match হলে family-create ফর্মের বদলে join-ফর্ম (nাম+DOB+sex, কোনো
//     Family Code চাওয়া হয় না)

import { Card, BootSplash, TextField, PrimaryButton, ErrorBox, SelectField, DateField } from "../shared/ui.js";
import {
  triggerGoogleSignInPopup,
  signInExistingMemberByGoogle,
  currentGoogleEmail,
  createFamilyAndOwnProfile,
  joinFamilyViaInviteLink,
} from "../legacy/googleAuth.js";

const { useState, useEffect, useCallback } = React;

const SEX_OPTIONS = [["male", "পুরুষ"], ["female", "মহিলা"]];

export function GoogleSignInGate({ uid, inviteFamilyId, inviteToken, onSuccess }) {
  // "idle" | "checking" | "new-user-form" | "submitting" | "error"
  const [stage, setStage] = useState(uid ? "checking" : "idle");
  const [errorMsg, setErrorMsg] = useState(null);
  const [familyCode, setFamilyCode] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");

  const runMatchCheck = useCallback(() => {
    setErrorMsg(null);
    setStage("checking");
    signInExistingMemberByGoogle()
      .then((res) => {
        if (res && res.matched) {
          onSuccess(res.familyId, res.memberId, res.memberData);
        } else {
          if (res && res.reason === "already-claimed") {
            setErrorMsg("এই ইমেইল ইতিমধ্যে অন্য একটা Google account দিয়ে claim হয়ে গেছে।");
          }
          setStage("new-user-form");
        }
      })
      .catch((err) => {
        setErrorMsg("চেক করা যায়নি — আবার চেষ্টা করুন।" + (err && err.code ? ` [${err.code}]` : ""));
        setStage("idle");
      });
  }, [onSuccess]);

  // uid আগে থেকেই থাকলে (page-reload, session persisted) — বাটন ছাড়াই
  // স্বয়ংক্রিয় check (কোনো দ্বিতীয় popup লাগে না)।
  useEffect(() => {
    if (uid) runMatchCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const handleSignInClick = useCallback(() => {
    setErrorMsg(null);
    setStage("checking");
    triggerGoogleSignInPopup()
      .then(() => signInExistingMemberByGoogle())
      .then((res) => {
        if (res && res.matched) {
          onSuccess(res.familyId, res.memberId, res.memberData);
        } else {
          if (res && res.reason === "already-claimed") {
            setErrorMsg("এই ইমেইল ইতিমধ্যে অন্য একটা Google account দিয়ে claim হয়ে গেছে।");
          }
          setStage("new-user-form");
        }
      })
      .catch((err) => {
        setErrorMsg("সাইন-ইন করা যায়নি। আবার চেষ্টা করুন।" + (err && err.code ? ` [${err.code}]` : ""));
        setStage("idle");
      });
  }, [onSuccess]);

  const handleSubmitForm = useCallback(() => {
    if (!name.trim()) { setErrorMsg("নাম লিখুন।"); return; }
    if (!dob) { setErrorMsg("জন্ম-তারিখ দিন।"); return; }
    setErrorMsg(null);
    setStage("submitting");

    const task = inviteFamilyId
      ? joinFamilyViaInviteLink(inviteFamilyId, inviteToken, { name: name.trim(), dob, sex })
      : createFamilyAndOwnProfile(familyCode.trim(), { name: name.trim(), dob, sex })
          .then((r) => ({ success: true, familyId: r.familyId, memberId: r.memberId }));

    task
      .then((res) => {
        if (res && res.success) {
          onSuccess(res.familyId, res.memberId, res.memberData);
          return;
        }
        const msgMap = {
          "invalid-token": "এই আমন্ত্রণ লিংক আর কার্যকর নেই।",
          "family-not-found": "পরিবার পাওয়া যায়নি।",
          "already-member-elsewhere": "এই Google account ইতিমধ্যে অন্য একটা পরিবারের সদস্য।",
          "email-already-member": "এই ইমেইল ইতিমধ্যে অন্য কারো সাথে যুক্ত।",
          "name-required": "নাম লিখুন।",
          "dob-required": "জন্ম-তারিখ দিন।",
        };
        setErrorMsg((res && msgMap[res.reason]) || "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।");
        setStage("new-user-form");
      })
      .catch((err) => {
        setErrorMsg(err.message || "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।");
        setStage("new-user-form");
      });
  }, [inviteFamilyId, inviteToken, familyCode, name, dob, sex, onSuccess]);

  if (stage === "checking") return React.createElement(BootSplash);

  if (stage === "new-user-form" || stage === "submitting") {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "var(--hs-primary, #0E4B43)", fontSize: "22px", margin: "0 0 6px" } },
          inviteFamilyId ? "এই পরিবারে যোগ দিন" : "নতুন পরিবার তৈরি করুন"),
        React.createElement("p", { style: { color: "#555", fontSize: "14px" } },
          currentGoogleEmail()
            ? `${currentGoogleEmail()} — এই মেইল দিয়ে আগে কোনো প্রোফাইল পাওয়া যায়নি। নিচের তথ্য দিন।`
            : "নিচের তথ্য দিন।"
        ),
        !inviteFamilyId && TextField("পরিবারের কোড (আপনি ঠিক করুন)", familyCode, setFamilyCode, "যেমন: rahman_family"),
        TextField("আপনার নাম", name, setName, "আপনার নাম"),
        DateField("জন্ম-তারিখ", dob, setDob),
        SelectField("লিঙ্গ", sex, setSex, SEX_OPTIONS),
        errorMsg && ErrorBox(errorMsg),
        PrimaryButton(
          stage === "submitting" ? "তৈরি হচ্ছে..." : (inviteFamilyId ? "যোগ দিন" : "একাউন্ট তৈরি করুন"),
          handleSubmitForm, stage === "submitting"
        )
      )
    );
  }

  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("div", { style: { width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", margin: "0 auto 14px", boxShadow: "0 6px 16px rgba(14,75,67,0.3)" } }, "🩺"),
      React.createElement("h1", { style: { color: "var(--hs-primary, #0E4B43)", fontSize: "24px", textAlign: "center", margin: "0" } }, "Health Companion"),
      React.createElement("p", { style: { color: "#4B5C57", fontSize: "14px", marginTop: "8px", textAlign: "center", lineHeight: 1.6 } },
        "পারিবারিক স্বাস্থ্য সহায়ক — শুরু করতে Google দিয়ে সাইন-ইন করুন।"),
      errorMsg && ErrorBox(errorMsg),
      PrimaryButton("🔵 Google দিয়ে সাইন-ইন করুন", handleSignInClick, false)
    )
  );
}
