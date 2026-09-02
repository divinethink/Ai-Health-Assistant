// প্রথম Admin-এর নিজের Member profile তৈরি। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { Card, TextField, PrimaryButton, ErrorBox } from "../shared/ui.js";
import { createOwnMemberProfile } from "../legacy/familyIdentity.js";

const { useState, useCallback } = React;

export function CreateOwnProfile({ familyId, uid, onProfileReady }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const todayISO = new Date().toISOString().slice(0, 10);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      const memberId = await createOwnMemberProfile(familyId, uid, { name: name.trim(), dob, sex });
      onProfileReady(memberId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, uid, name, dob, sex, onProfileReady]);

  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "আপনার প্রোফাইল"),
      React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "পরিবার তৈরি হয়েছে — এখন নিজের প্রোফাইল দিন (আপনি এই পরিবারের প্রথম Admin)।"),
      TextField("নাম", name, setName, "আপনার নাম"),
      React.createElement(
        "div", { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "জন্ম-তারিখ"),
        React.createElement("input", {
          type: "date", min: "1960-01-01", max: todayISO, value: dob,
          onChange: (e) => setDob(e.target.value),
          style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
        })
      ),
      React.createElement(
        "div", { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "লিঙ্গ"),
        React.createElement(
          "select", { value: sex, onChange: (e) => setSex(e.target.value),
            style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" } },
          React.createElement("option", { value: "male" }, "পুরুষ"),
          React.createElement("option", { value: "female" }, "মহিলা")
        )
      ),
      err && ErrorBox(err),
      PrimaryButton("প্রোফাইল তৈরি করুন", submit, busy)
    )
  );
}
