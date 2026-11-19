import test from "node:test";
import assert from "node:assert/strict";
import { filterBySearch } from "../../src/health/mycare/careSearch.js";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";

const entries = ALL_ITEMS.filter((i) => i.status === "verified").map((item) => ({ item, notes: [] }));

test("খোঁজ: ফাঁকা = সব; অমিল = ফাঁকা", () => {
  assert.equal(filterBySearch(entries, "  ").length, entries.length);
  assert.equal(filterBySearch(entries, "zzzxqq").length, 0);
});
test("খোঁজ: বাংলা ও ইংরেজি নামে মেলে, সব শব্দ লাগে", () => {
  const bn = filterBySearch(entries, "সানস্ক্রিন");
  assert.ok(bn.length >= 1);
  const en = filterBySearch(entries, "sunscreen");
  assert.ok(en.length >= 1);
  assert.ok(filterBySearch(entries, "সানস্ক্রিন zzzxqq").length === 0);
});
test("খোঁজ: শুধু দেওয়া তালিকার ভেতর থেকে ফেরে (লুকানো আইটেম আসে না)", () => {
  const subset = entries.slice(0, 2);
  const r = filterBySearch(subset, "");
  assert.ok(r.every((e) => subset.includes(e)));
});
