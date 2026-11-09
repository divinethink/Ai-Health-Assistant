// ডাক্তার-সাজেশনের pure লজিক (UI/Firebase ছাড়া) — টেস্টযোগ্য।
// সাজেশন-উৎস: `doctors` ডিরেক্টরি + আগের রেকর্ডের treatingPhysician।
// Candidate আকার: { id?, name, specialtyCategory?, area?, hospital?, phone?, chamberAddress?, source }

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

function toAsciiDigits(s) {
  return String(s || "").replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

// "ডা./ডাঃ/ডাক্তার/Dr./Dr" উপসর্গ বাদ, case-fold, বাড়তি স্পেস/বিরামচিহ্ন বাদ।
export function normalizeName(raw) {
  let s = String(raw || "").toLowerCase().trim();
  s = s.replace(/^(ডা\.?|ডাঃ|ডাক্তার|dr\.?|doctor)(\s+|$)/i, "");
  s = s.replace(/^(ডা\.?|ডাঃ|dr\.?)(\s+|$)/i, ""); // "ডা. ডা. x" ধরনের দ্বিগুণ
  return s.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}

// ফোন: সংখ্যা মাত্র; +880/880 → 0।
export function normalizePhone(raw) {
  let d = toAsciiDigits(raw).replace(/\D/g, "");
  if (d.startsWith("880")) d = "0" + d.slice(3);
  return d;
}

// Duplicate key: নাম + ফোন। ফোন না থাকলে শুধু নাম (তখন একই নামের ভিন্ন ডাক্তার
// ভুলে এক না ধরতে duplicate-check-এ ফোন-মিল প্রয়োজন, নিচে isDuplicate দেখুন)।
export function doctorKey(name, phone) {
  return `${normalizeName(name)}|${normalizePhone(phone)}`;
}

export function isDuplicate(a, b) {
  const na = normalizeName(a.name), nb = normalizeName(b.name);
  if (!na || na !== nb) return false;
  const pa = normalizePhone(a.phone), pb = normalizePhone(b.phone);
  // দুটোতেই ফোন থাকলে মিলতে হবে; কোনোটায় না থাকলে নাম-মিলই duplicate।
  return pa && pb ? pa === pb : true;
}

// doctors ডিরেক্টরি + রেকর্ড → একক candidate তালিকা (duplicate বাদ; ডিরেক্টরি আগে)।
export function buildCandidates(doctors, records) {
  const out = [];
  const push = (c) => {
    if (!normalizeName(c.name)) return;
    if (out.some((x) => isDuplicate(x, c))) return;
    out.push(c);
  };
  for (const d of doctors || []) {
    push({ id: d.id, name: d.name, specialtyCategory: d.specialtyCategory || "", area: d.area || "", hospital: d.hospital || "", phone: d.phone || "", chamberAddress: d.chamberAddress || "", source: "directory" });
  }
  for (const r of records || []) {
    const tp = r && r.treatingPhysician;
    if (!tp || !tp.name) continue;
    push({ id: tp.doctorId || undefined, name: tp.name, specialtyCategory: tp.specialtyCategory || "", area: tp.area || "", hospital: tp.hospital || "", phone: tp.chamberContact || "", chamberAddress: "", source: "record" });
  }
  return out;
}

// query খালি + category আছে → সেই ক্যাটেগরির তালিকা।
// query আছে → নাম বা প্রতিষ্ঠানের prefix-match (শব্দ-শুরুও ধরে), category থাকলে তা filter।
export function suggestDoctors(candidates, { query = "", category = "", limit = 6 } = {}) {
  const q = normalizeName(query);
  const list = (candidates || []).filter((c) => !category || c.specialtyCategory === category);
  if (!q) return category ? list.slice(0, limit) : [];
  const starts = (text) => {
    const t = normalizeName(text);
    return t.startsWith(q) || t.split(" ").some((w) => w.startsWith(q));
  };
  const nameHits = [], orgHits = [];
  for (const c of list) {
    if (starts(c.name)) nameHits.push(c);
    else if (starts(c.hospital)) orgHits.push(c);
  }
  return nameHits.concat(orgHits).slice(0, limit);
}

// বাছা candidate থেকে ফর্মের ফিল্ড-patch (শুধু অ-খালি মান; ব্যবহারকারীর লেখা মোছে না)।
export function pickPatch(c) {
  const patch = { name: c.name };
  for (const k of ["specialtyCategory", "area", "hospital", "phone", "chamberAddress"]) {
    if (c[k]) patch[k] = c[k];
  }
  if (c.id) patch.doctorId = c.id;
  return patch;
}
