// Admin — সদস্য যোগ ফর্ম (key generate করে)। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { TextField, PrimaryButton, SecondaryButton, ErrorBox, SuccessBox } from "../shared/ui.js";
import { addMemberByAdmin } from "../legacy/familyIdentity.js";

const { useState, useCallback } = React;

export function AddMemberForm({ familyId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null); // { name, key }
  const todayISO = new Date().toISOString().slice(0, 10);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      const { key } = await addMemberByAdmin(familyId, { name: name.trim(), dob, sex });
      setResult({ name: name.trim(), key });
      setName(""); setDob(""); setSex("male");
      onAdded();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, name, dob, sex, onAdded]);

  if (!open) {
    return React.createElement(
      "div", { style: { marginTop: "16px" } },
      SecondaryButton("+ নতুন সদস্য যোগ করুন", () => { setOpen(true); setResult(null); }, false)
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "16px", padding: "14px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "নতুন সদস্য"),
    TextField("নাম", name, setName, "সদস্যের নাম"),
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
    result && SuccessBox(
      React.createElement(
        React.Fragment, null,
        React.createElement("div", null, React.createElement("b", null, result.name), "-এর Key তৈরি হয়েছে:"),
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, marginTop: "4px", letterSpacing: "1px" } }, result.key),
        React.createElement("div", { style: { fontSize: "12px", marginTop: "4px" } }, "এই Key সদস্যকে দিন — তিনি নিজের ডিভাইসে \"Key দিয়ে লগইন\" থেকে claim করবেন। এই Key আর দেখানো হবে না (Admin পরে আবার দেখতে পারবেন)।")
      )
    ),
    PrimaryButton("সদস্য তৈরি করুন", submit, busy),
    SecondaryButton("বন্ধ করুন", () => setOpen(false), false)
  );
}
