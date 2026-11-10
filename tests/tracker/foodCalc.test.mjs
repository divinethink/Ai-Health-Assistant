import test from "node:test";
import assert from "node:assert/strict";
import { FOOD_NUTRITION, nutritionOf } from "../../src/health/tracker/foodNutrition.js";
import { scaleNutrition, measureToGrams, sumNutrition, fmtMacro, per100Of, measuresOf, slotBudgets, recentFoodEntries } from "../../src/health/tracker/foodCalc.js";
import { sanitizeExtraFoods, extraFoodsKcal, caloriesForDay } from "../../src/health/tracker/planPrefs.js";

test("scaleNutrition: ১০০ গ্রামে per100-এর সমান; ১৮০ গ্রাম ডাল ≈ আনুপাতিক", () => {
  const p = nutritionOf("rice").per100;
  assert.deepEqual(scaleNutrition("rice", 100), { kcal: p.kcal, p: p.p, c: p.c, f: p.f, fib: p.fib });
  const x = scaleNutrition("rice", 250);
  assert.equal(x.kcal, Math.round(p.kcal * 2.5));
  assert.equal(x.p, Math.round(p.p * 25) / 10);
});

test("scaleNutrition: অজানা key বা অবৈধ গ্রাম → null", () => {
  for (const g of [0, -5, 2001, NaN, "abc", undefined, null]) assert.equal(scaleNutrition("rice", g), null, String(g));
  assert.equal(scaleNutrition("nope", 100), null);
  assert.equal(scaleNutrition("__proto__", 100), null);
  assert.equal(scaleNutrition("rice", 1).kcal, 1);
});

test("measureToGrams: মাপ×পরিমাণ; অবৈধ → null", () => {
  const m = nutritionOf("rice").measures[0];
  assert.equal(measureToGrams("rice", m.id, 1), m.g);
  assert.equal(measureToGrams("rice", m.id, 1.5), Math.round(m.g * 1.5));
  assert.equal(measureToGrams("rice", "nope", 1), null);
  assert.equal(measureToGrams("nope", "cup", 1), null);
  for (const q of [0, -1, NaN, "x", 101]) assert.equal(measureToGrams("rice", m.id, q), null, String(q));
  assert.equal(measureToGrams("rice", m.id, 100), null); // ফল ২০০০ গ্রামের বেশি
});

test("প্রতিটি খাবারের ডিফল্ট মাপ ১ একক → বৈধ গ্রাম ও স্কেল-ফল", () => {
  for (const k of Object.keys(FOOD_NUTRITION)) {
    const m = measuresOf(k)[0];
    const g = measureToGrams(k, m.id, 1);
    assert.equal(g, m.g, k);
    const s = scaleNutrition(k, g);
    assert.ok(s && s.kcal >= 0, k);
    assert.ok(Math.abs(s.kcal - nutritionOf(k).per100.kcal * g / 100) <= 0.5, k); // স্কেলিং-সঙ্গতি
  }
});

test("per100Of/measuresOf: কপি দেয় (মূল ডেটা বদলায় না); নেই → null/[]", () => {
  const a = per100Of("rice"); a.kcal = 1;
  assert.notEqual(nutritionOf("rice").per100.kcal, 1);
  const b = measuresOf("rice"); b[0].g = 1;
  assert.notEqual(nutritionOf("rice").measures[0].g, 1);
  assert.equal(per100Of("nope"), null);
  assert.deepEqual(measuresOf("nope"), []);
});

test("sumNutrition: মিশ্র (পুরনো + নতুন) এন্ট্রি; খালি/অবৈধ নিরাপদ", () => {
  const e = [
    { name: "ভাত", kcal: 208, slot: "lunch", p: 4.3, c: 45.1, f: 0.5, fib: 0.6 },
    { name: "সিঙ্গারা", kcal: 260, slot: "snack1" },
    { name: "ডাল", kcal: 176, slot: "lunch", p: 11.2, c: 25.2, f: 4, fib: 4.7 },
  ];
  const s = sumNutrition(e);
  assert.deepEqual(s, { kcal: 644, p: 15.5, c: 70.3, f: 4.5, fib: 5.3, total: 3, withMacro: 2 });
  assert.deepEqual(sumNutrition([]), { kcal: 0, p: 0, c: 0, f: 0, fib: 0, total: 0, withMacro: 0 });
  assert.equal(sumNutrition(null).kcal, 0);
  assert.equal(sumNutrition([null, {}, { kcal: "x" }, 5]).total, 0);
});

test("fmtMacro: ১ দশমিক, বাংলা অঙ্ক", () => {
  assert.equal(fmtMacro(11.24), "১১.২");
  assert.equal(fmtMacro(4), "৪.০");
  assert.equal(fmtMacro(NaN), "—");
});

test("sanitizeExtraFoods: পুরনো {name,kcal,slot} হুবহু অপরিবর্তিত", () => {
  const old = [{ name: "চা", kcal: 30, slot: "snack1" }, { name: "কেক", kcal: 300, slot: "snack2" }];
  assert.deepEqual(sanitizeExtraFoods(old), old);
});

test("sanitizeExtraFoods: নতুন ফিল্ড রাখে; অবৈধ ফিল্ড বাদ, এন্ট্রি থাকে", () => {
  const ok = { name: "ডাল", kcal: 176, slot: "lunch", key: "dal", qty: 1, measure: "bowl", grams: 180, p: 11.2, c: 25.2, f: 4, fib: 4.7 };
  assert.deepEqual(sanitizeExtraFoods([ok]), [ok]);
  const bad = { name: "ডাল", kcal: 176, slot: "lunch", key: "a b/c", qty: -1, measure: "x".repeat(30), grams: 5000, p: -1, c: 501, f: "x", fib: null, evil: 1 };
  assert.deepEqual(sanitizeExtraFoods([bad]), [{ name: "ডাল", kcal: 176, slot: "lunch" }]);
  const edge = sanitizeExtraFoods([{ name: "ক", kcal: 1, slot: "lunch", grams: 1, p: 0, c: 500 }])[0];
  assert.equal(edge.grams, 1); assert.equal(edge.p, 0); assert.equal(edge.c, 500);
  assert.equal(sanitizeExtraFoods([{ name: "ক", kcal: 1, slot: "lunch", grams: 2000 }])[0].grams, 2000);
  assert.equal("grams" in sanitizeExtraFoods([{ name: "ক", kcal: 1, slot: "lunch", grams: 0 }])[0], false);
});

test("sanitizeExtraFoods: idempotent; সীমা ২০ বহাল; অবৈধ মূল এন্ট্রি বাদ", () => {
  const raw = [{ name: "ভাত", kcal: 208, slot: "lunch", key: "rice", grams: 160, p: 4.3, c: 45.1, f: 0.5, fib: 0.6 }];
  const once = sanitizeExtraFoods(raw);
  assert.deepEqual(sanitizeExtraFoods(once), once);
  const many = Array.from({ length: 30 }, (_, i) => ({ name: "খাবার" + i, kcal: 10, slot: "lunch" }));
  assert.equal(sanitizeExtraFoods(many).length, 20);
  assert.deepEqual(sanitizeExtraFoods([{ name: "x", kcal: 99999, slot: "lunch" }, { name: "y", kcal: 5, slot: "bogus" }, "s", null]), []);
});

test("মোট ক্যালরি সঙ্গতি: নতুন ফিল্ড থাকলেও extraFoodsKcal/caloriesForDay একই; sumNutrition.kcal মেলে", () => {
  const g = measureToGrams("rice", "cup", 1);
  const s = scaleNutrition("rice", g);
  const entry = { name: "ভাত", kcal: s.kcal, slot: "lunch", key: "rice", measure: "cup", qty: 1, grams: g, p: s.p, c: s.c, f: s.f, fib: s.fib };
  const list = sanitizeExtraFoods([entry, { name: "চা", kcal: 30, slot: "snack1" }]);
  assert.equal(extraFoodsKcal(list), s.kcal + 30);
  assert.equal(caloriesForDay({ slots: [] }, [], list), s.kcal + 30);
  assert.equal(sumNutrition(list).kcal, extraFoodsKcal(list));
});

// ---------- ধাপ ২ ----------
import { buildFoodEntry, slotForNow, entryAmountText } from "../../src/health/tracker/foodCalc.js";
import { setFoodOverrides } from "../../src/health/tracker/mealPlanData.js";

test("slotForNow: সময় → ডিফল্ট বেলা", () => {
  const at = (h, m = 0) => slotForNow(new Date(2026, 10, 10, h, m));
  assert.equal(at(7), "breakfast"); assert.equal(at(10), "snack1"); assert.equal(at(13), "lunch");
  assert.equal(at(16), "snack2"); assert.equal(at(21), "dinner"); assert.equal(at(1), "breakfast");
});

test("buildFoodEntry: মাপ-মোড → sanitize-সঙ্গত এন্ট্রি; sanitize-এ অপরিবর্তিত", () => {
  const e = buildFoodEntry("dal", "lunch", { measureId: "bowl", qty: 1.5 });
  assert.equal(e.grams, 240); assert.equal(e.measure, "bowl"); assert.equal(e.qty, 1.5); assert.equal(e.slot, "lunch");
  assert.deepEqual(sanitizeExtraFoods([e]), [e]);
  assert.equal(e.kcal, scaleNutrition("dal", 240).kcal);
});

test("buildFoodEntry: গ্রাম-মোড; অবৈধ → null", () => {
  const e = buildFoodEntry("rice", "dinner", { measureId: "g", grams: "150" });
  assert.equal(e.grams, 150); assert.equal("measure" in e, false);
  assert.deepEqual(sanitizeExtraFoods([e]), [e]);
  for (const g of ["", "0", "-3", "abc", "2001"]) assert.equal(buildFoodEntry("rice", "dinner", { measureId: "g", grams: g }), null, g);
  assert.equal(buildFoodEntry("rice", "bogus", { measureId: "g", grams: 100 }), null);
  assert.equal(buildFoodEntry("nope", "lunch", { measureId: "g", grams: 100 }), null);
  assert.equal(buildFoodEntry("rice", "lunch", { measureId: "nomeasure", qty: 1 }), null);
  assert.equal(buildFoodEntry("rice", "lunch", { measureId: "cup", qty: 0 }), null);
});

test("buildFoodEntry: সীমা — kcal>৩০০০ বা ম্যাক্রো>৫০০ হলে null (sanitize-এ নিঃশব্দে হারাত)", () => {
  assert.equal(buildFoodEntry("badam", "snack1", { measureId: "g", grams: 2000 }), null);
  assert.equal(buildFoodEntry("rice", "lunch", { measureId: "g", grams: 2000 }), null); // কার্ব ৫৬৪ গ্রাম
  assert.ok(buildFoodEntry("rice", "lunch", { measureId: "g", grams: 1500 }));
});

test("buildFoodEntry: নিজের মান (override) থাকলে ইউনিট-মোড, ম্যাক্রো ছাড়া", () => {
  setFoodOverrides({ rice: { k: 300 } });
  try {
    const e = buildFoodEntry("rice", "lunch", { qty: 2 });
    assert.deepEqual(e, { name: "ভাত", kcal: 600, slot: "lunch", key: "rice", qty: 2 });
    assert.deepEqual(sanitizeExtraFoods([e]), [e]);
  } finally { setFoodOverrides({}); }
});

test("entryAmountText", () => {
  assert.equal(entryAmountText(buildFoodEntry("dal", "lunch", { measureId: "bowl", qty: 1 })), "১ বাটি ≈ ১৬০ গ্রাম");
  assert.equal(entryAmountText(buildFoodEntry("rice", "lunch", { measureId: "g", grams: 150 })), "১৫০ গ্রাম");
  assert.equal(entryAmountText({ name: "চা", kcal: 30, slot: "snack1" }), "");
  assert.equal(entryAmountText(null), "");
});

test("slotBudgets: বেলা-ভিত্তিক খাওয়া/পরিকল্পনা, caloriesForDay-এর সাথে মোট মেলে", () => {
  const plan = { slots: [{ id: "breakfast", kcal: 400 }, { id: "lunch", kcal: 600 }] };
  const extras = [{ name: "কলা", kcal: 90, slot: "breakfast" }, { name: "চা", kcal: 30, slot: "lunch" }, { name: "ডিম", kcal: 77, slot: "breakfast" }];
  const b = slotBudgets(plan, ["lunch"], extras);
  assert.deepEqual(b, { breakfast: { planned: 400, eaten: 167 }, lunch: { planned: 600, eaten: 630 } });
  assert.equal(b.breakfast.eaten + b.lunch.eaten, caloriesForDay(plan, ["lunch"], extras));
});
test("slotBudgets: খালি/অবৈধ ইনপুটে ভাঙে না", () => {
  assert.deepEqual(slotBudgets(null, null, null), {});
  assert.deepEqual(slotBudgets({ slots: [{ id: "lunch", kcal: 500 }] }, undefined, [null, { slot: "lunch", kcal: NaN }]), { lunch: { planned: 500, eaten: 0 } });
});

test("recentFoodEntries: পূর্ণ এন্ট্রি, ফ্রিকোয়েন্সি-ক্রম, নতুনটি জেতে, ৭ দিনের বাইরে বাদ", () => {
  const now = new Date(2026, 10, 10);
  const rice1 = { name: "ভাত", kcal: 195, slot: "lunch", key: "rice", measure: "g", grams: 150 };
  const rice2 = { name: "ভাত", kcal: 260, slot: "dinner", key: "rice", measure: "g", grams: 200 };
  const docs = [
    { date: "2026-11-08", extraFoods: [rice1, { name: "চা", kcal: 30, slot: "snack1" }] },
    { date: "2026-11-09", extraFoods: [rice2] },
    { date: "2026-10-20", extraFoods: [{ name: "পুরনো", kcal: 10, slot: "lunch" }, { name: "চা", kcal: 30, slot: "snack1" }] },
    null, { date: "2026-11-09" },
  ];
  const r = recentFoodEntries(docs, { now });
  assert.deepEqual(r.map((x) => x.name), ["ভাত", "চা"]);
  assert.equal(r[0].grams, 200); // সবচেয়ে সাম্প্রতিক
  assert.equal(r[0].key, "rice");
  assert.equal(recentFoodEntries(docs, { now, limit: 1 }).length, 1);
  assert.deepEqual(recentFoodEntries(null), []);
});

test("entryAmountText: পুরনো/ইউনিট-মোড এন্ট্রিতেও আনুমানিক গ্রাম; override থাকলে নয়", () => {
  assert.equal(entryAmountText({ name: "ডাল", kcal: 112, slot: "lunch", key: "dal", qty: 1 }), "১ বাটি ≈ ১৬০ গ্রাম");
  assert.equal(entryAmountText({ name: "রুটি", kcal: 168, slot: "breakfast", key: "roti", qty: 2 }), "২ টি ≈ ৬৪ গ্রাম");
  setFoodOverrides({ dal: { k: 200 } });
  try { assert.equal(entryAmountText({ name: "ডাল", kcal: 200, slot: "lunch", key: "dal", qty: 1 }), "১ বাটি"); }
  finally { setFoodOverrides({}); }
});
