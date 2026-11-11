// src/health/doctor-details/DoctorCardPanel.js
//
// ধাপ ৪-ঙ — নথি-আপলোডে ধরন "ডাক্তারের কার্ড" (নিজে চেনা বা হাতে বাছা) হলে খোলে। ছবি আগেই vault-এ
// সংরক্ষিত, তাই ডাক্তার-তালিকায় নতুন ডাক্তার যোগের সময় ছবি দ্বিতীয়বার আপলোড হয় না (file = null)।
// আগের OCR-টেক্সট (`preOcr`) থাকলে DoctorFieldsRow সেটাই ব্যবহার করে (দুবার OCR নয়); না থাকলে এখানে একবার পড়ে।
// কিছুই নিজে সেভ হয় না — শুধু খালি ঘরে পূরণ, হলুদ চিহ্ন, তারপর ব্যবহারকারী "ডাক্তার-তালিকায় যোগ করুন" চাপলে।

import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createDoctor, listDoctors, DOCTOR_CATEGORIES } from "./doctorDetailsData.js";
import { DoctorFieldsRow } from "./DoctorFieldsRow.js";
import { buildCandidates, suggestDoctors, pickPatch, isDuplicate } from "./doctorSuggest.js";
import { readDocumentText, asOcrLike } from "../doc-ai/readDocText.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const h = React.createElement;

export function DoctorCardPanel({ familyId, callerMemberId, file, preOcr, onClose }) {
  const [pre, setPre] = useState(preOcr || null);
  const [loadErr, setLoadErr] = useState(null);
  const [progress, setProgress] = useState(0);
  const [v, setV] = useState({ name: "", specialtyCategory: DOCTOR_CATEGORIES[0][0], area: "", hospital: "", chamberAddress: "", phone: "" });
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (pre) return undefined;
    let alive = true;
    readDocumentText(file, { onProgress: (p) => alive && setProgress(p) })
      .then((r) => alive && setPre(r))
      .catch((e) => alive && setLoadErr(e.message || String(e)));
    return () => { alive = false; };
  }, []); // শুধু mount-এ একবার
  useEffect(() => {
    let alive = true;
    listDoctors(familyId).then((d) => alive && setExisting(d)).catch(() => {});
    return () => { alive = false; };
  }, [familyId]);
  const suggestions = useMemo(() => suggestDoctors(buildCandidates(existing, []), { query: v.name }), [existing, v.name]);

  const submit = useCallback(async () => {
    setErr(null);
    if (submitting.current) return; // double-tap রোধ
    if (!v.name.trim()) { setErr("ডাক্তারের নাম লিখুন।"); return; }
    let current = existing;
    try { current = await listDoctors(familyId); } catch (_e) { /* আগের তালিকায় চলবে */ }
    if (current.some((d) => isDuplicate(d, v))) { setErr("এই নাম ও ফোনের ডাক্তার আগে থেকেই তালিকায় আছে।"); return; }
    submitting.current = true; setBusy(true);
    try { await createDoctor(familyId, callerMemberId, v, null); setDone(true); }
    catch (e) { setErr(e.code === "permission-denied" ? "ডাক্তার যোগ করার অনুমতি আপনার নেই।" : (e.message || String(e))); }
    finally { submitting.current = false; setBusy(false); }
  }, [familyId, callerMemberId, v, existing]);

  if (done) return h("div", null, SuccessBox("✅ ডাক্তার-তালিকায় যোগ হয়েছে (🩺 ডাক্তার ট্যাবে দেখুন)। কার্ডের ছবি নথিতে সংরক্ষিত আছে।"), SecondaryButton("বন্ধ করুন", onClose, false));
  if (loadErr) return h("div", null, ErrorBox(loadErr), SecondaryButton("বন্ধ করুন", onClose, false));
  if (!pre) return h("p", { role: "status", style: { fontSize: "14px", color: "#5F716C", margin: "12px 0" } }, "📇 কার্ড পড়া হচ্ছে… " + Math.round(progress * 100) + "%");

  return h("div", null,
    h("p", { style: { fontSize: "14px", color: "#5F716C", margin: "4px 0 0" } }, "কার্ড থেকে যা পড়া গেছে বসিয়েছি — হলুদ ঘরগুলো মিলিয়ে নিন, তারপর যোগ করুন।"),
    h(DoctorFieldsRow, {
      value: v, suggestions, file, familyId, preOcr: asOcrLike(pre), autoScan: true,
      onChange: (patch) => setV((p) => ({ ...p, ...patch })),
      onPick: (c) => setV((p) => ({ ...p, ...pickPatch(c) })),
    }),
    err && ErrorBox(err),
    PrimaryButton("🩺 ডাক্তার-তালিকায় যোগ করুন", submit, busy),
    SecondaryButton("এখন নয়", onClose, busy));
}
