// ট্র্যাকার ধাপ B — pure lib (UI/Firestore জড়িত নয়)।
// "আমার প্ল্যান" = goal-ডকের `planPrefs` (স্থায়ী); "আজ শুধু" = daily-ডকের `extraFoods`/`exerciseLog`।
// প্রজেক্টে schema-লাইব্রেরি নেই, তাই data-boundary যাচাই এখানে হাতে-লেখা sanitize*() (idempotent;
// সীমা firestore.rules-এর সাথে মেলানো: extraFoods/exerciseLog ≤২০, meal ≤৫ স্লট, exercise ≤৭ দিন)।
// সব ফিল্ড ঐচ্ছিক — না থাকলে বিদ্যমান ডিফল্ট প্ল্যান অপরিবর্তিত।

import { bnNum } from "../../shared/dates.js";
import { MEAL_SLOTS, FOODS, kcalOf, itemText, caloriesForEaten } from "./mealPlanData.js";
import { MIN_KCAL } from "./trackerCalc.js";

export const PLAN_PREFS_VERSION = 1;
export const MAX_QTY = 10;
export const MAX_ITEMS_PER_SLOT = 12;
export const MAX_ITEMS_PER_DAY = 6;
export const MAX_LIST = 20;
export const MAX_KCAL = 3000;
export const MAX_EX_MIN = 300;
export const MIN_EX_MIN = 5;

// counted=false মানে সাপ্তাহিক লক্ষ্যে মিনিট গোনা হয় না (exercisePlanData.js-এর মতো)।
export const EXERCISE_TYPES = {
  walk: { label: "দ্রুত হাঁটা", counted: true },
  run: { label: "দৌড়/জগিং", counted: true },
  cycling: { label: "সাইকেল", counted: true },
  gym: { label: "জিম/শক্তির ব্যায়াম", counted: true },
  sports: { label: "খেলাধুলা", counted: true },
  swim: { label: "সাঁতার", counted: true },
  yoga: { label: "যোগব্যায়াম", counted: true },
  other: { label: "অন্য", counted: true },
  stretch: { label: "স্ট্রেচিং", counted: false },
};

const SLOT_IDS = MEAL_SLOTS.map((s) => s.id);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function cleanQty(q) {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = Math.round(n * 2) / 2; // আধা-ধাপ (১, ১½, ২ ...)
  return r >= 0.5 && r <= MAX_QTY ? r : null;
}
function cleanMin(m, lo, hi) {
  const n = Math.round(Number(m));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

// ---------- sanitize (data-boundary) ----------
export function sanitizePlanPrefs(raw) {
  const out = { v: PLAN_PREFS_VERSION, meal: {}, exercise: {} };
  if (!isObj(raw)) return out;
  if (isObj(raw.meal)) {
    SLOT_IDS.forEach((id) => {
      if (!hasOwn(raw.meal, id) || !Array.isArray(raw.meal[id])) return;
      out.meal[id] = raw.meal[id].slice(0, MAX_ITEMS_PER_SLOT).map((r) => {
        if (!isObj(r) || !hasOwn(FOODS, r.food)) return null;
        const qty = cleanQty(r.qty);
        return qty === null ? null : { food: r.food, qty };
      }).filter(Boolean);
    });
  }
  if (isObj(raw.exercise)) {
    for (let d = 0; d < 7; d++) {
      const k = String(d);
      if (!hasOwn(raw.exercise, k) || !Array.isArray(raw.exercise[k])) continue;
      out.exercise[k] = raw.exercise[k].slice(0, MAX_ITEMS_PER_DAY).map((r) => {
        if (!isObj(r) || !hasOwn(EXERCISE_TYPES, r.type)) return null;
        const min = cleanMin(r.min, MIN_EX_MIN, MAX_EX_MIN);
        return min === null ? null : { type: r.type, min };
      }).filter(Boolean);
    }
  }
  return out;
}

export function sanitizeExtraFoods(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_LIST).map((r) => {
    if (!isObj(r) || typeof r.name !== "string") return null;
    const name = r.name.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    const kcal = cleanMin(r.kcal, 0, MAX_KCAL);
    if (!name || kcal === null || !SLOT_IDS.includes(r.slot)) return null;
    return { name, kcal, slot: r.slot };
  }).filter(Boolean);
}

// গত `days` দিনের (আজসহ) দৈনিক ডক থেকে "সাম্প্রতিক খাবার" — নাম অনুযায়ী ফ্রিকোয়েন্সিতে সেরা `limit`টি (১-ট্যাপ চিপের জন্য)।
// pure; নতুন Firestore read নেই (বিদ্যমান ৩০-দিনের `recent` ডক ব্যবহার)। একই নাম (ছোট-হাতের, ফাঁকা-স্পেস সমান) = এক খাবার;
// সমান ফ্রিকোয়েন্সিতে নতুনটি আগে, তারপর নামের ক্রম। kcal = সবচেয়ে সাম্প্রতিক এন্ট্রির মান।
export function recentExtraFoods(dailyDocs, { now = new Date(), days = 7, limit = 8 } = {}) {
  const p2 = (n) => String(n).padStart(2, "0");
  const dates = new Set(Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }));
  const seen = new Map();
  (Array.isArray(dailyDocs) ? dailyDocs : []).forEach((doc) => {
    if (!isObj(doc) || !dates.has(doc.date)) return;
    sanitizeExtraFoods(doc.extraFoods).forEach((x) => {
      const key = x.name.toLowerCase();
      const cur = seen.get(key);
      if (!cur) seen.set(key, { name: x.name, kcal: x.kcal, count: 1, last: doc.date });
      else {
        cur.count++;
        if (doc.date > cur.last) { cur.last = doc.date; cur.kcal = x.kcal; cur.name = x.name; }
      }
    });
  });
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit))
    .map(({ name, kcal, count }) => ({ name, kcal, count }));
}

export function sanitizeExerciseLog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_LIST).map((r) => {
    if (!isObj(r) || !hasOwn(EXERCISE_TYPES, r.type)) return null;
    const min = cleanMin(r.min, 1, MAX_EX_MIN);
    return min === null ? null : { type: r.type, min };
  }).filter(Boolean);
}

// ---------- বিকল্প তালিকা (UI-র জন্য) ----------
// সব খাবার থাকে; এলার্জির ট্যাগ-মেলা খাবারে allergy:true (শুধু সতর্কতা, ব্লক নয়)।
export function mealOptions(allergyTags) {
  const tags = new Set(allergyTags || []);
  return Object.entries(FOODS)
    .map(([key, f]) => ({ key, name: f.n, unit: f.u, kcal: f.k, allergy: !!(f.al && tags.has(f.al)) }));
}
export function exerciseOptions() {
  return Object.entries(EXERCISE_TYPES).map(([type, e]) => ({ type, label: e.label, counted: e.counted }));
}

// ---------- মিল ----------
// plan: buildMealPlan() এর ফল। prefs.meal[slot] থাকলে ওই বেলার আইটেম পুরো বদলে যায় ([] = বেলা বাদ)।
export function applyMealPrefs(plan, prefs, allergyTags) {
  const p = sanitizePlanPrefs(prefs);
  const tags = new Set(allergyTags || []);
  const notes = [...plan.notes];
  const custom = [];
  const slots = plan.slots.map((s) => {
    if (!hasOwn(p.meal, s.id)) return s;
    custom.push(s.id);
    const items = p.meal[s.id].map((r) => {
      const f = FOODS[r.food];
      const allergy = !!(f.al && tags.has(f.al));
      if (allergy) notes.push("⚠ " + f.n + " আপনার প্রোফাইলের এলার্জির সাথে মিলতে পারে — সতর্ক থাকুন।");
      return { key: r.food, qty: r.qty, swapped: false, custom: true, allergy, text: itemText(r.food, r.qty), kcal: Math.round(kcalOf(r.food, r.qty)) };
    });
    return { ...s, items, kcal: items.reduce((a, i) => a + i.kcal, 0) };
  });
  return { slots, total: slots.reduce((a, s) => a + s.kcal, 0), notes, custom };
}

export function extraFoodsKcal(extraFoods) {
  return sanitizeExtraFoods(extraFoods).reduce((a, x) => a + x.kcal, 0);
}

// আজকের caloriesIn = টিক-করা বেলা (কার্যকর প্ল্যান থেকে) + আজ নিজে যোগ-করা খাবার।
export function caloriesForDay(plan, eatenIds, extraFoods) {
  return caloriesForEaten(plan, eatenIds) + extraFoodsKcal(extraFoods);
}

// sex: "male" | "female" | অন্যথায় ন্যূনতম-সীমার সতর্কতা বাদ। target: ক্যালরি-টার্গেট।
export function mealWarnings(total, { sex, target } = {}) {
  const w = [];
  if (MIN_KCAL[sex] && total < MIN_KCAL[sex]) w.push("প্ল্যানের মোট " + bnNum(total) + " কিলোক্যালরি — ন্যূনতম নিরাপদ সীমা " + bnNum(MIN_KCAL[sex]) + "-এর নিচে। কিছু খাবার যোগ করুন।");
  if (target && total > target + 300) w.push("প্ল্যান টার্গেটের চেয়ে প্রায় " + bnNum(Math.round(total - target)) + " কিলোক্যালরি বেশি।");
  return w;
}

// ---------- ব্যায়াম ----------
// plan: exercisePlan() এর ফল। routine না থাকলে (৫ বছরের কম) অপরিবর্তিত।
// আইটেম-key: স্ট্রেচিং → "stretch", প্রথম অন্য → "main", এরপর "x2","x3"... (বিদ্যমান টিক-key-র সাথে মেলে)।
export function applyExercisePrefs(plan, prefs) {
  if (!plan || !plan.routine) return plan;
  const p = sanitizePlanPrefs(prefs);
  const custom = [];
  const routine = plan.routine.map((items, i) => {
    const ov = p.exercise[String(i)];
    if (!ov) return items;
    custom.push(i);
    let n = 0;
    return ov.map((r) => {
      const t = EXERCISE_TYPES[r.type];
      let key = "stretch";
      if (r.type !== "stretch") { n++; key = n === 1 ? "main" : "x" + n; }
      return { key, type: r.type, label: t.label, min: r.min, counted: t.counted };
    });
  });
  return { ...plan, routine, custom };
}

export function exerciseLogMinutes(exerciseLog) {
  return sanitizeExerciseLog(exerciseLog).filter((x) => EXERCISE_TYPES[x.type].counted).reduce((a, x) => a + x.min, 0);
}

// plan: applyExercisePrefs() এর ফল; weeklyMin: plannedWeeklyMinutes(plan)।
export function exerciseWarnings(plan, weeklyMin) {
  const w = [];
  if (!plan || !plan.routine) return w;
  if (plan.routine.some((day) => day.reduce((a, x) => a + x.min, 0) > 120)) w.push("কোনো দিনে ২ ঘণ্টার বেশি ব্যায়াম রাখা হয়েছে — ধীরে বাড়ান, শরীর খারাপ লাগলে থামুন।");
  if ((plan.band === "adult" || plan.band === "senior") && weeklyMin > 300) w.push("সপ্তাহে ৩০০ মিনিটের বেশি রাখা হয়েছে (WHO: এর পরে বাড়তি উপকার কম)। হঠাৎ না বাড়িয়ে ধীরে বাড়ান।");
  return w;
}

// ---------- এডিট-হেল্পার (ধাপ B-২; UI এগুলো ডাকে, সব pure — ইনপুট mutate করে না) ----------
// prefs-এর বদল সবসময় sanitize হয়ে বেরোয়, তাই Firestore-এ অবৈধ কিছু যায় না।
export function setSlotPref(prefs, slotId, items) {
  const p = sanitizePlanPrefs(prefs);
  if (!SLOT_IDS.includes(slotId)) return p;
  return sanitizePlanPrefs({ ...p, meal: { ...p.meal, [slotId]: items } });
}
export function clearSlotPref(prefs, slotId) {
  const p = sanitizePlanPrefs(prefs);
  const meal = { ...p.meal };
  delete meal[slotId];
  return { ...p, meal };
}
export function setDayPref(prefs, dayIdx, items) {
  const p = sanitizePlanPrefs(prefs);
  if (!Number.isInteger(dayIdx) || dayIdx < 0 || dayIdx > 6) return p;
  return sanitizePlanPrefs({ ...p, exercise: { ...p.exercise, [String(dayIdx)]: items } });
}
export function clearDayPref(prefs, dayIdx) {
  const p = sanitizePlanPrefs(prefs);
  const exercise = { ...p.exercise };
  delete exercise[String(dayIdx)];
  return { ...p, exercise };
}

// বেলার বর্তমান আইটেম (buildMealPlan/applyMealPrefs-এর slot.items) → এডিটের খসড়া [{food, qty}]
export const draftFromSlotItems = (items) => (items || []).map((i) => ({ food: i.key, qty: i.qty }));

// খসড়া-তালিকার ছোট অপারেশন (শেষ ফল sanitize-এর আগের খসড়া; সীমা এখানেই মানা হয়)
export function addDraftFood(draft, food) {
  if (!hasOwn(FOODS, food)) return draft;
  const i = draft.findIndex((r) => r.food === food);
  if (i >= 0) return changeDraftQty(draft, i, 0.5);
  if (draft.length >= MAX_ITEMS_PER_SLOT) return draft;
  return [...draft, { food, qty: 1 }];
}
export function changeDraftQty(draft, i, delta) {
  return draft.map((r, k) => (k === i ? { ...r, qty: Math.min(MAX_QTY, Math.max(0.5, r.qty + delta)) } : r));
}
export const removeDraftAt = (draft, i) => draft.filter((_, k) => k !== i);
export const draftKcal = (draft) => Math.round(draft.reduce((a, r) => a + kcalOf(r.food, r.qty), 0));

// ব্যায়ামের বিদ্যমান আইটেম (type নেই) → খসড়া [{type, min}]
export function draftFromDayItems(items) {
  return (items || []).map((it) => {
    let type = it.type;
    if (!hasOwn(EXERCISE_TYPES, type)) {
      if (it.key === "stretch") type = "stretch";
      else if ((it.label || "").startsWith("শক্তির")) type = "gym";
      else if ((it.label || "").includes("খেলাধুলা")) type = "sports";
      else if ((it.label || "").includes("হাঁটা")) type = "walk";
      else type = "other";
    }
    return { type, min: it.min };
  });
}
export function addDraftExercise(draft, type) {
  if (!hasOwn(EXERCISE_TYPES, type) || draft.length >= MAX_ITEMS_PER_DAY) return draft;
  return [...draft, { type, min: type === "stretch" ? 10 : 30 }];
}
export function changeDraftMin(draft, i, delta) {
  return draft.map((r, k) => (k === i ? { ...r, min: Math.min(MAX_EX_MIN, Math.max(MIN_EX_MIN, r.min + delta)) } : r));
}
export const draftDayMinutes = (draft) => draft.reduce((a, r) => a + r.min, 0);

// আজকের রুটিন বদলালে: টিক-করা আইটেমের মিনিট নতুন/পুরনো তালিকা থেকে মিলিয়ে exerciseMin-এর বদল (delta) ও
// বৈধ থাকা টিক-key ফেরত দেয় (যে key আর নেই সেটার টিক বাদ)। counted=false (স্ট্রেচিং) মিনিটে গোনা হয় না।
export function reconcileExerciseDone(oldItems, newItems, done) {
  const set = new Set(Array.isArray(done) ? done : []);
  const sum = (items) => items.filter((i) => set.has(i.key) && i.counted).reduce((a, i) => a + i.min, 0);
  const keep = (done || []).filter((k) => newItems.some((i) => i.key === k));
  return { done: keep, deltaMin: sum(newItems) - sum(oldItems) };
}

// "নিজের খাবার" ও "আজ আসলে" ফর্মের যাচাই — ত্রুটি-বার্তা অথবা null
export function checkExtraFood(name, kcal, currentCount) {
  const n = String(name || "").replace(/\s+/g, " ").trim();
  if (!n) return "খাবারের নাম দিন।";
  if (n.length > 40) return "নাম ৪০ অক্ষরের মধ্যে দিন।";
  const k = Number(kcal);
  if (String(kcal).trim() === "" || !Number.isInteger(k) || k < 0 || k > MAX_KCAL) return "কিলোক্যালরি ০–" + bnNum(MAX_KCAL) + " এর মধ্যে পূর্ণসংখ্যা দিন।";
  if (currentCount >= MAX_LIST) return "আজকের জন্য সর্বোচ্চ " + bnNum(MAX_LIST) + "টি খাবার যোগ করা যায়।";
  return null;
}
export function checkExerciseLog(min, currentCount) {
  const m = Number(min);
  if (!Number.isInteger(m) || m < 1 || m > MAX_EX_MIN) return "মিনিট ১–" + bnNum(MAX_EX_MIN) + " এর মধ্যে দিন।";
  if (currentCount >= MAX_LIST) return "আজকের জন্য সর্বোচ্চ " + bnNum(MAX_LIST) + "টি যোগ করা যায়।";
  return null;
}
