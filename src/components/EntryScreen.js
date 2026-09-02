// Entry screen: family create / resume / Direct-Identify। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { Card, TextField, PrimaryButton, ErrorBox } from "../shared/ui.js";
import { FAMILY_ID_STORAGE_KEY, createFamily, resolveFamilyIdByCode, claimByKey } from "../legacy/familyIdentity.js";

const { useState, useCallback } = React;

export function EntryScreen({ uid, onFamilyReady }) {
  const [mode, setMode] = useState("create"); // "create" | "resume" | "key"
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submitFamily = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      const familyId = mode === "create" ? await createFamily(code, uid) : await resolveFamilyIdByCode(code);
      localStorage.setItem(FAMILY_ID_STORAGE_KEY, familyId);
      onFamilyReady(familyId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [mode, code, uid, onFamilyReady]);

  const submitKey = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      const { familyId } = await claimByKey(key, uid);
      localStorage.setItem(FAMILY_ID_STORAGE_KEY, familyId);
      onFamilyReady(familyId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [key, uid, onFamilyReady]);

  const tabs = [
    ["create", "নতুন পরিবার"],
    ["resume", "কোড দিয়ে লোড"],
    ["key", "Key দিয়ে লগইন"],
  ];

  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
      React.createElement(
        "div", { style: { display: "flex", gap: "6px", marginTop: "12px" } },
        tabs.map(([m, label]) =>
          React.createElement("button", {
            key: m, onClick: () => setMode(m),
            style: {
              flex: 1, padding: "8px 4px", borderRadius: "6px", fontSize: "12px",
              border: mode === m ? "2px solid #0E4B43" : "1px solid #CBD5E1",
              background: mode === m ? "#E8F3EC" : "#fff", cursor: "pointer",
            },
          }, label)
        )
      ),
      mode !== "key"
        ? React.createElement(
            React.Fragment, null,
            React.createElement("p", { style: { color: "#555", fontSize: "13px", marginTop: "10px" } },
              mode === "create"
                ? "আপনার পরিবারের জন্য একটা ইউনিক কোড দিন (শুধু English অক্ষর/সংখ্যা/-/_ , ৬-৩০ ক্যারেক্টার)।"
                : "আগে তৈরি করা পরিবারের কোড দিয়ে এই ডিভাইসে পুনরায় সংযুক্ত করুন।"
            ),
            TextField(mode === "create" ? "পরিবারের কোড (আপনি ঠিক করুন)" : "পরিবারের কোড", code, setCode, "যেমন: rahman_family"),
            err && ErrorBox(err),
            PrimaryButton(mode === "create" ? "পরিবার তৈরি করুন" : "লোড করুন", submitFamily, busy)
          )
        : React.createElement(
            React.Fragment, null,
            React.createElement("p", { style: { color: "#555", fontSize: "13px", marginTop: "10px" } },
              "Admin আপনাকে যে Key দিয়েছেন সেটা লিখুন — এই ডিভাইসে আপনার প্রোফাইল claim হবে (পরিবারের কোড জানার দরকার নেই)।"
            ),
            TextField("আপনার Key", key, setKey, "যেমন: Karim42"),
            err && ErrorBox(err),
            PrimaryButton("লগইন করুন", submitKey, busy)
          )
    )
  );
}
