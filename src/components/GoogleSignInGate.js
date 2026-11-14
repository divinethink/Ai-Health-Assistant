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

// Google "G" লোগো (অফিশিয়াল রং) — সাদা গোল ব্যাজে, সবুজ বাটনের ওপর স্পষ্ট দেখাতে।
function GoogleG() {
  const P = (fill, d) => React.createElement("path", { fill, d });
  return React.createElement("span", { "aria-hidden": "true", style: { width: "28px", height: "28px", borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
    React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 48 48" },
      P("#EA4335", "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"),
      P("#4285F4", "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"),
      P("#FBBC05", "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"),
      P("#34A853", "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z")));
}

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
      React.createElement("img", { src: "/icons/family-tree-512.png", alt: "", style: { width: "72px", height: "72px", borderRadius: "20px", display: "block", margin: "0 auto 14px", boxShadow: "0 6px 16px rgba(14,75,67,0.3)" } }),
      React.createElement("h1", { style: { color: "var(--hs-primary, #0E4B43)", fontSize: "24px", textAlign: "center", margin: "0" } }, "Health Companion"),
      React.createElement("p", { style: { color: "#4B5C57", fontSize: "14px", marginTop: "8px", textAlign: "center", lineHeight: 1.6 } },
        "পারিবারিক স্বাস্থ্য সহায়ক — শুরু করতে Google দিয়ে সাইন-ইন করুন।"),
      errorMsg && ErrorBox(errorMsg),
      PrimaryButton(React.createElement("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px" } }, React.createElement(GoogleG), "Google দিয়ে সাইন-ইন করুন"), handleSignInClick, false)
    )
  );
}
