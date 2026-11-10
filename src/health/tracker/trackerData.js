// হেলথ ট্র্যাকার — Firestore (families/{fid}/healthTracker)।
// goal: ডক-ID `goal_{memberId}`; daily: `daily_{memberId}_{YYYY-MM-DD}` — একই ID-তে set(merge)
// তাই বারবার সেভ করলেও ডুপ্লিকেট হয় না (idempotent)। read সবসময় equality-query (rules-এ
// resource.data.memberId লাগে বলে সরাসরি get() নয়)।
// `sources` map: প্রতিটি ফিল্ডের উৎস ("manual" এখন; পরে "health-connect")।
// `reminders`: ধাপ ৩-এর রিমাইন্ডার-সেটিং (saveReminders)। saveGoal এটা ছোঁয় না, তাই লক্ষ্য বদলালে সেটিং হারায় না।

import { db } from "../../legacy/firebaseConfig.js";
import { createHealthRecord, updateHealthRecord } from "../records/healthRecordsData.js";
import { sanitizePlanPrefs, sanitizeExtraFoods, sanitizeExerciseLog } from "./planPrefs.js";
import { sanitizeFastDays, sanitizeWaterTarget } from "./trackerCalc.js";
import { sanitizeTaken } from "../records/medTaken.js";

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
    lastEditedByMemberId: callerMemberId,
    updatedAt: ts(),
    ...(prevGoal ? {} : { createdAt: ts() }),
  }, { merge: true });
}

// পার্ট ১০: ঐচ্ছিক goal-ফিল্ড `fastDays` (উপবাস-দিবস, ≤২) ও `waterTarget` (১–২০, null = ডিফল্ট)।
// mergeFields — অন্য goal-ফিল্ড (লক্ষ্য/রিমাইন্ডার/planPrefs) ছোঁয় না; নির্দিষ্ট ডক-ID তাই retry-নিরাপদ।
// সেফটি-গেট এখানে নেই (বয়স/রোগ এই স্তরে অজানা): সেভের আগে checkFastDaysInput ও পড়ার সময় activeFastDays গেট প্রয়োগ করে।
export async function saveGoalExtras(familyId, memberId, callerMemberId, { fastDays, waterTarget }, prevGoal) {
  const fields = ["type", "memberId", "fastDays", "waterTarget", "lastEditedByMemberId", "updatedAt", ...(prevGoal ? [] : ["createdAt"])];
  await col(familyId).doc("goal_" + memberId).set({
    type: "goal", memberId, fastDays: sanitizeFastDays(fastDays), waterTarget: sanitizeWaterTarget(waterTarget),
    lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(prevGoal ? {} : { createdAt: ts() }),
  }, { mergeFields: fields });
}

export async function saveReminders(familyId, memberId, callerMemberId, reminders, prevGoal) {
  await col(familyId).doc("goal_" + memberId).set({
    type: "goal", memberId, reminders,
    lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(prevGoal ? {} : { createdAt: ts() }),
  }, { merge: true });
}

// "আমার প্ল্যান" (ধাপ B): goal-ডকের `planPrefs` পুরোটা একসাথে বদলায় (mergeFields — তাই "ডিফল্টে ফিরুন" = খালি prefs
// লিখলে পুরনো স্লট/দিনের বদল মুছে যায়)। নির্দিষ্ট ডক-ID → retry/double-submit-এ ডুপ্লিকেট নয়; conflict = last-write-wins
// (`updatedAt`, `lastEditedByMemberId`)। লক্ষ্য (saveGoal) ও রিমাইন্ডার এটা ছোঁয় না।
export async function savePlanPrefs(familyId, memberId, callerMemberId, planPrefs, prevGoal) {
  const fields = ["type", "memberId", "planPrefs", "lastEditedByMemberId", "updatedAt", ...(prevGoal ? [] : ["createdAt"])];
  await col(familyId).doc("goal_" + memberId).set({
    type: "goal", memberId, planPrefs: sanitizePlanPrefs(planPrefs),
    lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(prevGoal ? {} : { createdAt: ts() }),
  }, { mergeFields: fields });
}

// fields: { weightKg, waterGlasses, steps, exerciseMin, sleep, sleepMinutes, mealsEaten, caloriesIn, exerciseDone, extraFoods, exerciseLog } — সব ঐচ্ছিক।
// extraFoods/exerciseLog (ধাপ B, "আজ শুধু"): পুরো তালিকা একসাথে বদলায় (array merge হয় না)।
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
  if (fields.extraFoods !== undefined) out.extraFoods = sanitizeExtraFoods(fields.extraFoods);
  if (fields.exerciseLog !== undefined) out.exerciseLog = sanitizeExerciseLog(fields.exerciseLog);
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

// "ওষুধ খেয়েছি" লগ (ধাপ ২)। daily-ডকের `medTaken` map: key = doseKey(), মান true। সব ডিভাইসে মেলে, ডাক্তার-এক্সপোর্টের
// adherence-এ কাজে লাগে। এক dose = এক key → নির্দিষ্ট ডক-ID, double-tap/retry-তে ডুপ্লিকেট হয় না (idempotent)।
export async function getMedTaken(familyId, memberId, date) {
  const d = await getDaily(familyId, memberId, date);
  return sanitizeTaken(d && d.medTaken);
}

// taken=true → key সেট; false → শুধু ওই key মোছা (বাকি ফিল্ড/key অক্ষত)। ডক না থাকলে (ওই দিনের প্রথম লেখা) তৈরি হয়।
export async function setMedDoseTaken(familyId, memberId, callerMemberId, date, key, taken) {
  const ref = col(familyId).doc("daily_" + memberId + "_" + date);
  const path = "medTaken." + key;
  try {
    await ref.update({ [path]: taken ? true : firebase.firestore.FieldValue.delete(), lastEditedByMemberId: callerMemberId, updatedAt: ts() });
  } catch (e) {
    if (e && e.code === "not-found") {
      if (!taken) return; // ডকই নেই = চিহ্নও নেই
      await ref.set({
        type: "daily", memberId, date, medTaken: { [key]: true }, caloriesIn: 0, sources: {},
        lastEditedByMemberId: callerMemberId, createdAt: ts(), updatedAt: ts(),
      }, { merge: true });
      return;
    }
    throw e;
  }
}
