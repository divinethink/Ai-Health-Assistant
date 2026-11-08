// হেলথ ট্র্যাকার — Firestore (families/{fid}/healthTracker)।
// goal: ডক-ID `goal_{memberId}`; daily: `daily_{memberId}_{YYYY-MM-DD}` — একই ID-তে set(merge)
// তাই বারবার সেভ করলেও ডুপ্লিকেট হয় না (idempotent)। read সবসময় equality-query (rules-এ
// resource.data.memberId লাগে বলে সরাসরি get() নয়)।
// `sources` map: প্রতিটি ফিল্ডের উৎস ("manual" এখন; পরে "health-connect")।
// `reminders`: ধাপ ৩-এর জন্য ঘর রাখা (এখন null)।

import { db } from "../../legacy/firebaseConfig.js";
import { createHealthRecord, updateHealthRecord } from "../records/healthRecordsData.js";

function col(familyId) {
  return db.collection("families").doc(familyId).collection("healthTracker");
}
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

export async function getGoal(familyId, memberId) {
  const snap = await col(familyId).where("memberId", "==", memberId).where("type", "==", "goal").get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getDaily(familyId, memberId, date) {
  const snap = await col(familyId).where("memberId", "==", memberId).where("date", "==", date).get();
  const d = snap.docs.find((x) => x.data().type === "daily");
  return d ? { id: d.id, ...d.data() } : null;
}

export async function saveGoal(familyId, memberId, callerMemberId, { goalType, activity, targetWeightKg, weeks, flags, calc }, prevGoal) {
  const ref = col(familyId).doc("goal_" + memberId);
  await ref.set({
    type: "goal", memberId, goalType, activity,
    targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
    weeks: weeks ? Number(weeks) : null,
    flags: { pregnant: !!flags.pregnant, diabetes: !!flags.diabetes, kidney: !!flags.kidney },
    calc: calc || null,
    reminders: null,
    lastEditedByMemberId: callerMemberId,
    updatedAt: ts(),
    ...(prevGoal ? {} : { createdAt: ts() }),
  }, { merge: true });
}

// fields: { weightKg, waterGlasses, steps, exerciseMin, sleep, sleepMinutes, mealsEaten, caloriesIn, exerciseDone } — সব ঐচ্ছিক।
// mealsEaten/exerciseDone: টিক-করা মিল-স্লট ও ব্যায়াম-আইটেমের আইডি (ধাপ ২); caloriesIn মিল-টিক থেকে হিসাব-করা।
// ওজন দিলে বিদ্যমান Observation-এও যায় (BMI/ডাক্তার-এক্সপোর্টের জন্য)।
export async function saveDaily(familyId, memberId, callerMemberId, date, fields, prev) {
  const out = { type: "daily", memberId, date, sources: { ...((prev && prev.sources) || {}) } };
  const put = (k, v) => { out[k] = v; out.sources[k] = "manual"; };

  if (fields.waterGlasses !== undefined) put("waterGlasses", fields.waterGlasses);
  if (fields.steps !== undefined) put("steps", fields.steps);
  if (fields.exerciseMin !== undefined) put("exerciseMin", fields.exerciseMin);
  if (fields.mealsEaten !== undefined) out.mealsEaten = fields.mealsEaten;
  if (fields.caloriesIn !== undefined) out.caloriesIn = fields.caloriesIn;
  if (fields.exerciseDone !== undefined) out.exerciseDone = fields.exerciseDone;
  if (fields.sleep !== undefined) {
    out.sleep = fields.sleep; out.sleepMinutes = fields.sleepMinutes; out.sources.sleep = "manual";
  }
  if (fields.weightKg !== undefined) {
    put("weightKg", fields.weightKg);
    const rec = { type: "weight", value: String(fields.weightKg), unit: "kg", date };
    if (prev && prev.weightObsId) {
      if (prev.weightKg !== fields.weightKg) await updateHealthRecord(familyId, prev.weightObsId, "observation", callerMemberId, rec);
      out.weightObsId = prev.weightObsId;
    } else {
      out.weightObsId = await createHealthRecord(familyId, memberId, callerMemberId, "observation", rec);
    }
  }
  const ref = col(familyId).doc("daily_" + memberId + "_" + date);
  await ref.set({
    ...out, lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(prev ? {} : { createdAt: ts(), ...(fields.caloriesIn === undefined ? { caloriesIn: 0 } : {}) }),
  }, { merge: true });
}

// সপ্তাহের (শনি–শুক্র) দৈনিক ডক। `in` = সমতা-ধরনের ফিল্টার, তাই নতুন index লাগে না;
// memberId সমতা থাকায় rules-এর read-নিয়ম মানে। কোনো .limit() নেই (হিসাব truncate হবে না)।
export async function getWeekDaily(familyId, memberId, dates) {
  const snap = await col(familyId).where("memberId", "==", memberId).where("date", "in", dates).get();
  return snap.docs.map((d) => d.data()).filter((x) => x.type === "daily");
}
