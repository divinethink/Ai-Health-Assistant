// খাদ্য-তালিকা সংক্ষেপ (display-only, pure — React/Firestore নেই, unit-testable)।
// সমস্যা: দুই উৎস (Firestore রোগ-নিয়ম + কোডের অবস্থা-নিয়ম) শুধু হুবহু-একই বাক্য এক করে; ভাষা সামান্য আলাদা
// হলে একই কথা ৩ বার আসে (যেমন "ভাজাপোড়া…")। এখানে একই ধরনের বাক্য ১টা ছোট লাইনে আনা হয়।
// নিয়ম: (১) একই ধরনের ≥২টা বাক্য থাকলেই শুধু মেলানো — একটা থাকলে মূল বাক্য অক্ষত; (২) নিরাপত্তা/বিশেষ-শর্তওয়ালা
// বাক্য ("সাথে", "সম্পূর্ণ", "বিশেষত", "অ্যালকোহল", "পটাশিয়াম", বয়স…) কখনো মেলানো হয় না; (৩) কোনো ডেটা/schema বদল নেই,
// রোগ-ভিত্তিক বিস্তারিত (byTag) আগের মতোই থাকে।

const GUARD = /সাথে|সম্পূর্ণ|বিশেষত|অ্যালকোহল|সবরিটল|পটাশিয়াম|প্রোটিন|বছর|বয়স|ক্যাফেইন|গর্ভ|মধু|কাঁচা|আধা/;
const TOKEN_CHA = /(^|[\s/,(\-–])চা([\s/,)।\-–]|$)/;

const AVOID_CONCEPTS = [
  { id: "trigger", test: (s) => /উপসর্গ বাড়ে/.test(s) && /লিখে/.test(s) }, // সাধারণ "লিখে রাখুন" নোট → অভ্যাস-টিপসে (খাবার নয়); নির্দিষ্ট উদাহরণসহ বাক্য avoid-এই থাকে
  { id: "fried", label: "ভাজাপোড়া, তেল-চর্বি, ঝাল-মসলাদার খাবার", test: (s) => /ভাজা|তেল|ঝাল|মসলা/.test(s) },
  { id: "processed", label: "প্রসেসড/ফাস্ট ফুড", test: (s) => /প্রসেসড|ফাস্ট ?ফুড/.test(s) },
  { id: "caffeine", label: "চা-কফি, গ্যাসযুক্ত (কার্বনেটেড) পানীয়", test: (s) => TOKEN_CHA.test(s) || /কফি|কার্বনেটেড|গ্যাসযুক্ত/.test(s) },
  { id: "sugar", label: "চিনি, মিষ্টি ও চিনিযুক্ত পানীয়", test: (s) => /চিনি|মিষ্টি|সফট ড্রিংক/.test(s) },
];

const TIP_CONCEPTS = [
  { id: "small", label: "নিয়মিত সময়ে অল্প অল্প করে, ধীরে খাওয়া", test: (s) => /ছোট-?\s?ছোট|অল্প অল্প|ছোট পরিমাণে|portion|নিয়ন্ত্রিত পরিমাণে|ঘন ঘন/.test(s) },
];

export const TRIGGER_TIP = "যে খাবারে উপসর্গ বাড়ে তা লিখে রাখুন ও কমান (ডাক্তার/পুষ্টিবিদের পরামর্শ নিন)";

const uniq = (a) => [...new Set(a)];
const clean = (a) => uniq((a || []).map((x) => String(x).trim()).filter(Boolean));
const conceptOf = (concepts, s) => {
  const t = concepts.find((c) => c.id === "trigger");
  if (t && t.test(s)) return t;
  return GUARD.test(s) ? null : concepts.find((c) => c.id !== "trigger" && c.test(s)) || null;
};

// avoidFoods + avoidSources + habitTips → সংক্ষিপ্ত রূপ। অন্য কোনো ফিল্ড (includeFoods, byTag, matchedTags) অপরিবর্তিত।
export function compactGuidance(res) {
  if (!res) return res;
  const avoid = clean(res.avoidFoods);
  const src = res.avoidSources || {};
  const groups = new Map(); // concept id → { c, items }
  const order = []; // { text } বা { gid }
  let hasTrigger = false;
  avoid.forEach((it) => {
    const c = conceptOf(AVOID_CONCEPTS, it);
    if (c && c.id === "trigger") { hasTrigger = true; return; }
    if (!c) { order.push({ text: it, items: [it] }); return; }
    if (!groups.has(c.id)) { const g = { c, items: [] }; groups.set(c.id, g); order.push({ gid: c.id }); }
    groups.get(c.id).items.push(it);
  });
  const avoidFoods = [];
  const avoidSources = {};
  order.forEach((o) => {
    let text, items;
    if (o.gid) { const g = groups.get(o.gid); items = g.items; text = items.length >= 2 ? g.c.label : items[0]; }
    else { text = o.text; items = o.items; }
    if (avoidFoods.includes(text)) return;
    avoidFoods.push(text);
    const s = uniq(items.flatMap((i) => src[i] || []));
    if (s.length) avoidSources[text] = s;
  });

  // অভ্যাস-টিপস: একই ধরন মেলানো; উপসর্গ-নোট একটাই
  const tips = clean(res.habitTips);
  const tg = new Map();
  const tipOut = [];
  tips.forEach((t) => {
    if (/উপসর্গ বাড়ে/.test(t) && /লিখে/.test(t)) { hasTrigger = true; return; }
    const c = TIP_CONCEPTS.find((x) => x.test(t));
    if (!c) { tipOut.push({ text: t }); return; }
    if (!tg.has(c.id)) { tg.set(c.id, { c, items: [] }); tipOut.push({ gid: c.id }); }
    tg.get(c.id).items.push(t);
  });
  const habitTips = uniq(tipOut.map((o) => (o.gid ? (tg.get(o.gid).items.length >= 2 ? tg.get(o.gid).c.label : tg.get(o.gid).items[0]) : o.text)));
  if (hasTrigger) habitTips.push(TRIGGER_TIP);

  return { ...res, avoidFoods, avoidSources, habitTips };
}
