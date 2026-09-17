// Admin — guardian-managed (no-account) সদস্য যোগ ফর্ম। Google Sign-in
// Amendment (Architecture Part A §3.0) — আগের Member-Key generation বাদ;
// এখন googleUid:null দিয়ে তৈরি হয়, email ঐচ্ছিক (দিলে সদস্য ভবিষ্যতে নিজে
// Google দিয়ে সাইন-ইন করে auto-claim করতে পারবেন)।

import { TextField, PrimaryButton, SecondaryButton, ErrorBox, SuccessBox } from "../shared/ui.js";
import { addGuardianManagedMember } from "../legacy/googleAuth.js";

const { useState, useCallback } = React;

export function AddMemberForm({ familyId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null); // { name, email }
  const todayISO = new Date().toISOString().slice(0, 10);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      await addGuardianManagedMember(familyId, { name: name.trim(), dob, sex, email: email.trim() || null });
      setResult({ name: name.trim(), email: email.trim() || null });
      setName(""); setDob(""); setSex("male"); setEmail("");
      onAdded();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, name, dob, sex, email, onAdded]);

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
    TextField("ইমেইল (ঐচ্ছিক)", email, setEmail, "সদস্য নিজে পরে claim করতে চাইলে"),
    React.createElement(
      "div", { style: { fontSize: "11px", color: "#777", marginTop: "4px" } },
      "এই সদস্যের নিজস্ব, স্বতন্ত্র email হতে হবে (আপনার email দেওয়া যাবে না)। খালি রাখলে এই সদস্য শুধু Admin/অভিভাবক দিয়েই পরিচালিত হবেন।"
    ),
    err && ErrorBox(err),
    result && SuccessBox(
      React.createElement(
        React.Fragment, null,
        React.createElement("div", null, React.createElement("b", null, result.name), " যোগ হয়েছে।"),
        result.email
          ? React.createElement("div", { style: { fontSize: "12px", marginTop: "4px" } }, `এই সদস্য "${result.email}" দিয়ে Google Sign-in করলে স্বয়ংক্রিয়ভাবে এই প্রোফাইল claim হয়ে যাবে।`)
          : React.createElement("div", { style: { fontSize: "12px", marginTop: "4px" } }, "এই সদস্যের কোনো account নেই — Admin/অভিভাবক এই প্রোফাইল পরিচালনা করবেন।")
      )
    ),
    PrimaryButton("সদস্য তৈরি করুন", submit, busy),
    SecondaryButton("বন্ধ করুন", () => setOpen(false), false)
  );
}
