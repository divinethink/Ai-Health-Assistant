import test from "node:test";
import assert from "node:assert/strict";
import { COMMON_HOMEO_DEFAULTS } from "../../src/health/commonCare/commonCareHomeoList.js";
import { COMMON_HERBAL_DEFAULTS } from "../../src/health/commonCare/commonCareHerbalList.js";
for (const [name, list] of [["homeo", COMMON_HOMEO_DEFAULTS], ["herbal", COMMON_HERBAL_DEFAULTS]]) {
  test(name + ": ≥২০, শিশু-এন্ট্রি, ইউনিক key, ডোজ/দাবি নেই", () => {
    assert.ok(list.length >= 20);
    assert.ok(list.filter((d) => d.kid).length >= 3);
    assert.equal(new Set(list.map((d) => d.key)).size, list.length);
    for (const d of list) {
      assert.ok(d.disease && d.items.length && d.note, d.key);
      const txt = [d.disease, d.note, ...d.items].join(" ");
      assert.ok(!/\d\s*(mg|ml|মিগ্রা|মিলি|ফোঁটা|চামচ)/i.test(txt), "ডোজ: " + d.key);
      assert.ok(!/কার্যকর|নিরাময়|প্রমাণিত|সারায়|সমাধান/.test(txt), "দাবি: " + d.key);
    }
  });
}

import { composeFrequency, patternFromString, hasPattern, togglePattern4 } from "../../src/health/commonCare/careMeds.js";
test("মাত্রা অটো-টেক্সট: ১+০+১, আগে/পরে, দিন", () => {
  assert.equal(composeFrequency({ pattern: [1, 0, 1], meal: "after", days: 5, asNeeded: false }), "১+০+১ · খাবারের পরে · ৫ দিন");
  assert.equal(composeFrequency({ pattern: [1, 1, 1], meal: "", days: 0 }), "১+১+১ · চলবে (নিয়মিত)");
  assert.equal(composeFrequency({ pattern: [0, 0, 0], meal: "before", days: null }), "");
  assert.equal(composeFrequency({ pattern: [0, 0, 0], meal: "after", asNeeded: true, days: 3 }), "প্রয়োজনে · খাবারের পরে");
  assert.deepEqual(patternFromString("1+0+1"), [1, 0, 1]);
  assert.deepEqual(patternFromString("abc"), [0, 0, 0]);
  assert.deepEqual(patternFromString("1+1+1+1"), [1, 1, 1, 1]);
  assert.equal(composeFrequency({ pattern: [1, 1, 1, 1], meal: "after", days: 7 }), "১+১+১+১ · খাবারের পরে · ৭ দিন");
  assert.deepEqual(togglePattern4([1, 0, 1]), [1, 0, 0, 1]);
  assert.deepEqual(togglePattern4([1, 0, 0, 1]), [1, 0, 1]);
  assert.equal(hasPattern([0, 0, 0]), false);
});

import { COMMON_CARE_DEFAULTS } from "../../src/health/commonCare/commonCareList.js";
test("এলোপ্যাথি: ২৭টি, ইউনিক key, ডোজ-সংখ্যা নেই, প্রতিটিতে নোট", () => {
  assert.ok(COMMON_CARE_DEFAULTS.length >= 27);
  assert.equal(new Set(COMMON_CARE_DEFAULTS.map((d) => d.key)).size, COMMON_CARE_DEFAULTS.length);
  for (const d of COMMON_CARE_DEFAULTS) {
    assert.ok(d.disease && d.generic && Array.isArray(d.brands) && d.note, d.key);
    assert.ok(!/\d\s*(mg|ml|মিগ্রা|মিলি)/i.test(d.note), "ডোজ: " + d.key);
  }
});
