import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { needsPatchTest, sanitizePatchList, startPatch, finishPatch, snoozePatch, patchState, duePatches, pruneExpired, PATCH_AFTER_MS, SNOOZE_MS, EXPIRE_MS, PATCH_MAX } from "../../src/health/mycare/carePatch.js";
import { buildShareText, shareText } from "../../src/health/mycare/careShare.js";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";

const H = 3600 * 1000, T0 = 1_800_000_000_000;

test("needsPatchTest: প্যাচ-নির্দেশ থাকা আইটেম ধরা পড়ে, বাকিগুলো নয়", () => {
  const yes = ALL_ITEMS.filter(needsPatchTest).map((i) => i.id);
  for (const id of ["skin-gentle-cleanser", "skin-sunscreen", "natural-aloe-gel", "hair-gentle-shampoo"]) assert.ok(yes.includes(id), id);
  assert.ok(!yes.includes("oral-fluoride-brushing"));
  assert.equal(needsPatchTest(null), false);
  assert.equal(needsPatchTest({ warnings: [], how: { bn: "x", en: "y" } }), false);
});

test("sanitizePatchList: ভুল id/সময় বাদ, ডুপ্লিকেট নয়, সর্বোচ্চ ৫", () => {
  const raw = [{ id: "a-1", at: T0 }, { id: "a-1", at: T0 + 1 }, { id: "Bad Id", at: T0 }, { id: "b", at: "x" }, { id: "c", at: -5 }, null, 7,
    ...Array.from({ length: 9 }, (_, i) => ({ id: "n" + i, at: T0 }))];
  const out = sanitizePatchList(raw);
  assert.equal(out.length, PATCH_MAX);
  assert.equal(out.filter((x) => x.id === "a-1").length, 1);
  assert.deepEqual(sanitizePatchList("x"), []);
});

test("সময়-রেখা: ২৪ ঘণ্টার আগে waiting, পরে due, ৭ দিন পরে expired", () => {
  const l = startPatch([], "skin-moisturizer", T0);
  assert.equal(patchState(l, "skin-moisturizer", T0 + 23 * H), "waiting");
  assert.equal(patchState(l, "skin-moisturizer", T0 + PATCH_AFTER_MS), "due");
  assert.equal(duePatches(l, T0 + 30 * H).length, 1);
  assert.equal(duePatches(l, T0 + 2 * H).length, 0);
  assert.equal(patchState(l, "skin-moisturizer", T0 + EXPIRE_MS + 1), "expired");
  assert.equal(patchState(l, "nope", T0), null);
  assert.equal(pruneExpired(l, T0 + EXPIRE_MS + 1).length, 0);
});

test("snooze: ৬ ঘণ্টা লুকায়; উত্তর দিলে মুছে যায়; আবার শুরু করলে নতুন সময়; সীমায় পুরনোটি বাদ", () => {
  let l = startPatch([], "a", T0);
  const now = T0 + 25 * H;
  l = snoozePatch(l, "a", now);
  assert.equal(patchState(l, "a", now + SNOOZE_MS - 1), "waiting");
  assert.equal(patchState(l, "a", now + SNOOZE_MS), "due");
  assert.deepEqual(finishPatch(l, "a"), []);
  l = startPatch(l, "a", T0 + 100 * H);
  assert.equal(l.length, 1); assert.equal(l[0].at, T0 + 100 * H); assert.equal(l[0].until, undefined);
  let m = [];
  for (let i = 0; i < 7; i++) m = startPatch(m, "i" + i, T0 + i);
  assert.equal(m.length, PATCH_MAX); assert.ok(!m.some((x) => x.id === "i0")); assert.equal(m[0].id, "i6");
  assert.deepEqual(startPatch([], "Bad Id", T0), []);
});

test("শেয়ার-লেখা: শুধু আইটেমের নাম/নিয়ম/সতর্কতা; দুই ভাষা; ব্যক্তিগত তথ্যের পথ নেই", () => {
  const it = ALL_ITEMS.find((i) => i.id === "skin-sunscreen");
  const bn = buildShareText(it, "bn"), en = buildShareText(it, "en");
  assert.ok(bn.includes(it.name.bn) && bn.includes(it.how.bn) && bn.includes("চিকিৎসা পরামর্শ নয়"));
  assert.ok(en.includes(it.name.en) && en.includes("not medical advice"));
  assert.equal(buildShareText(null, "bn"), "");
  assert.equal(buildShareText.length, 2); // (item, lang) ছাড়া কিছু নেয় না
  const src = readFileSync("src/health/mycare/careShare.js", "utf8");
  assert.ok(!/profile|allerg|member|familyId/i.test(src.replace(/\/\/.*$/gm, "")));
});

test("shareText: share → clipboard → unsupported; বাতিল ও ত্রুটি আলাদা", async () => {
  const calls = [];
  assert.equal(await shareText("t", "x", { share: async (d) => { calls.push(d); } }), "shared");
  assert.deepEqual(calls[0], { title: "t", text: "x" });
  assert.equal(await shareText("t", "x", { share: async () => { const e = new Error("c"); e.name = "AbortError"; throw e; } }), "cancelled");
  assert.equal(await shareText("t", "x", { share: async () => { throw new Error("boom"); } }), "error");
  let copied = "";
  assert.equal(await shareText("t", "x", { clipboard: { writeText: async (s) => { copied = s; } } }), "copied");
  assert.equal(copied, "t\n\nx");
  assert.equal(await shareText("t", "x", {}), "unsupported");
});

test("অন্যের মোডে প্যাচ-সংরক্ষণ/স্মরণ নেই; স্টোর শুধু localStorage (Firestore/AI/লগ নয়)", () => {
  const sec = readFileSync("src/health/mycare/MyCareSection.js", "utf8");
  assert.ok(sec.includes("patch: other ? null : patches"));
  assert.ok(sec.includes("!other && React.createElement(PatchCheckCard"));
  for (const f of ["carePatchStore.js", "carePatch.js", "PatchCheckCard.js", "careShare.js"]) {
    const s = readFileSync("src/health/mycare/" + f, "utf8");
    assert.ok(!/firebase|firestore|askAI|console\.|analytics/i.test(s.replace(/\/\/.*$/gm, "")), f);
  }
  assert.ok(readFileSync("src/health/mycare/carePatchStore.js", "utf8").includes("localStorage"));
});
