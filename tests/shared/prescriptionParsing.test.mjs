// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parsePrescriptionText, matchAllergy, findDuplicateMed, reminderTimesFor, frequencyText, parsePatternInput } from "../../src/health/prescriptions/prescriptionParsing.js";

const one = (t) => parsePrescriptionText(t)[0];

test("এক লাইনের ছাপা ধাঁচ: Tab. Napa 500mg 1+1+1 ৫ দিন খাবারের পরে", () => {
  const it = one("Tab. Napa 500mg 1+1+1 ৫ দিন খাবারের পরে");
  assert.equal(it.name, "Napa 500mg"); assert.equal(it.strength, "500 mg");
  assert.equal(it.patternRaw, "1+1+1"); assert.equal(it.perDay, 3); assert.equal(it.days, 5); assert.equal(it.meal, "after");
  assert.equal(it.clear, true);
});
test("বাংলা অঙ্কের প্যাটার্ন ও দিন; আগে/পরে", () => {
  const it = one("Cap. Seclo 20 ১+০+১ ১৪ দিন খাবারের আগে");
  assert.equal(it.patternRaw, "1+0+1"); assert.equal(it.days, 14); assert.equal(it.meal, "before");
  assert.deepEqual(reminderTimesFor(it), ["08:00", "20:00"]);
  assert.equal(frequencyText(it), "১+০+১, খাবারের আগে");
});
test("বহুলাইন (হাতে-লেখা ধাঁচ): নাম এক লাইনে, ডোজ ও দিন পরের লাইনে", () => {
  const items = parsePrescriptionText("1. Tab. Secnid DS\n0+0+2 — ৩ বার\n2. Tab. Alcet\n0+0+2 — ১৪দিন\n3. Cap. Itra 100mg\n0+0+2 — ১৪দিন\n4. Neosten cream\nআক্রান্ত জায়গায় দিবে ৩ বার\n২দিন");
  assert.deepEqual(items.map((i) => i.name), ["Secnid DS", "Alcet", "Itra 100mg", "Neosten cream"]);
  assert.equal(items[1].days, 14); assert.equal(items[2].days, 14);
  assert.equal(items[3].perDay, 3); assert.equal(items[3].days, 2);
  assert.equal(items[0].days, null); assert.ok(items[0].flags.includes("no-days"));
});
test("DocTime ধাঁচ: Shampoo/Gel ফর্ম রাখে, % শক্তি, '1 months' = ৩০ দিন, উপদেশ অংশ বাদ", () => {
  const t = "Chief Complaints:\n• Seborrhoic dermatitis\nRx\n1. Shampoo, Nizoder 2% (Ketoconazole (Shampoo))\n০+১+০\nসপ্তাহে তিন দিন গোসলের সময় মাথার ত্বকে লাগাবেন\n1 months\n2. Gel Retigel 0.05% (Tretinoin)\n০+০+১ রোজ রাতে পুরো মুখে লাগাবেন\n1 months\nFollow-up within: 1 Month\nAdvice:\n১. ফাটা দাগে Bio Oil ব্যবহার করবেন ২ থেকে ৩ বেলা";
  const items = parsePrescriptionText(t);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "Shampoo Nizoder 2% (Ketoconazole (Shampoo))"); assert.equal(items[0].strength, "2 %");
  assert.equal(items[0].patternRaw, "0+1+0"); assert.equal(items[0].days, 30);
  assert.equal(items[1].name, "Gel Retigel 0.05% (Tretinoin)"); assert.equal(items[1].patternRaw, "0+0+1"); assert.deepEqual(reminderTimesFor(items[1]), ["20:00"]);
});
test("সংখ্যা-তালিকার রোগ/উপসর্গ প্রমাণ ছাড়া ওষুধ নয়", () => {
  assert.deepEqual(parsePrescriptionText("1. Seborrhoic dermatitis\n2. Non lactating mother"), []);
  assert.equal(parsePrescriptionText("4. Neosten cream ৩ বার ২দিন").length, 1);
});
test("সপ্তাহ/মাস/BD/TDS/প্রয়োজনে", () => {
  assert.equal(one("Tab. A 500mg BD 2 weeks").days, 14);
  assert.equal(one("Tab. A 500mg BD 2 weeks").perDay, 2);
  assert.equal(one("Tab. B TDS 7 days").perDay, 3);
  const prn = one("Tab. Napa 500mg প্রয়োজনে");
  assert.equal(prn.prn, true); assert.deepEqual(reminderTimesFor(prn), []); assert.equal(frequencyText(prn), "প্রয়োজনে");
  assert.equal(one("Tab. C 3 months 1+0+0").days, 90);
});
test("'দিনে ৩ বার' দিনের সংখ্যা নয়; ফ্রিকোয়েন্সি", () => {
  const it = one("Syp. Zinc দিনে ৩ বার ৫ দিন");
  assert.equal(it.perDay, 3); assert.equal(it.days, 5); assert.equal(it.name, "Syp Zinc");
});
test("OCR অক্ষর-ডিজিট গোলমাল: চিহ্নিত, কিন্তু অ্যাপ বদলায় না", () => {
  const it = one("Tab. Napa 5OO mg 1+O+1 5 days");
  assert.ok(it.flags.includes("ocr-confusable")); assert.ok(it.confusions.length >= 1);
  assert.equal(it.patternRaw, null); // O-ওয়ালা প্যাটার্ন পার্স হয়নি
  assert.equal(it.clear, false);
});
test("প্যাটার্ন/দিন না থাকলে flag; নাম সন্দেহজনক হলে flag", () => {
  const it = one("Tab. Napa");
  assert.deepEqual(it.flags.sort(), ["no-days", "no-frequency"]);
  assert.ok(one("Tab. Sec1o 20 1+0+1 5 days").flags.includes("name-suspicious"));
  assert.ok(one("Tab. Napa 1+0+1 999 days").flags.includes("days-too-long"));
});
test("মুখবন্ধ/অন্যান্য লাইন উপেক্ষা; ফাঁকা টেক্সট", () => {
  assert.deepEqual(parsePrescriptionText(""), []);
  assert.deepEqual(parsePrescriptionText("Dr. Maria Seraj\nDate: 18th May, 2024\nName: Muslimah Age 24"), []);
});
test("matchAllergy: নাম/অংশ-মিল; ব্র্যান্ডে নয়; ছোট শব্দে ভুল-মিল নয়", () => {
  const al = [{ substance: "Amoxicillin" }, { substance: "Pe" }];
  assert.equal(matchAllergy("Amoxicillin 500mg", al), "Amoxicillin");
  assert.equal(matchAllergy("Cap. amoxicillin", al), "Amoxicillin");
  assert.equal(matchAllergy("Napa 500mg", al), null);
  assert.equal(matchAllergy("Napa", []), null);
});
test("findDuplicateMed: একই নাম চলমান হলে true, মেয়াদ-শেষ হলে false", () => {
  const recs = [{ resourceType: "medicationStatement", genericName: "Napa 500mg", endDate: "2026-12-01" }, { resourceType: "medicationStatement", genericName: "Old", endDate: "2026-01-01" }];
  assert.equal(findDuplicateMed("napa  500mg", recs, "2026-11-09"), true);
  assert.equal(findDuplicateMed("Old", recs, "2026-11-09"), false);
  assert.equal(findDuplicateMed("New", recs, "2026-11-09"), false);
});
test("parsePatternInput (ব্যবহারকারীর সম্পাদনা)", () => {
  assert.equal(parsePatternInput("১+০+১").patternRaw, "1+0+1");
  assert.equal(parsePatternInput("BD").perDay, 2);
  assert.equal(parsePatternInput("কিছু একটা"), null);
});
test("নম্বর-তালিকায় নামের শেষে ফর্ম-শব্দ (Neosten cream) ধরা পড়ে; ফর্ম-শব্দহীন নম্বর-লাইন নয়", () => {
  const r = parsePrescriptionText("1. Tab. Alcet\n0+0+১ ---- ১৪দিন\n4. Neosten cream\nআক্রান্ত জায়গায় দিনে ৩ বার\n৭দিন\n5. Seborrhoic dermatitis");
  assert.equal(r.length, 2);
  const c = r[1];
  assert.equal(c.name, "Neosten cream");
  assert.equal(c.form, "Cream");
  assert.equal(c.perDay, 3);
  assert.equal(c.days, 7);
});
