import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ENUMS, LIMITS, sanitizeCarePrefs } from "../../src/health/mycare/carePrefsSchema.js";

test("sanitize — অবৈধ মান বাদ, সীমা প্রয়োগ", () => {
  const r = sanitizeCarePrefs({
    skinType: "purple", hairType: "curly", skinConcerns: ["acne", "bogus", "acne", "scars"],
    preferences: ["steroid", "herbal"], avoidIngredients: [" Lanolin ", "", "x".repeat(60), "lanolin"],
    region: "  ", breastfeeding: "yes", extra: 1,
  });
  assert.equal(r.skinType, null); assert.equal(r.hairType, "curly");
  assert.deepEqual(r.skinConcerns, ["acne", "scars"]);
  assert.deepEqual(r.preferences, ["herbal"]);
  assert.equal(r.avoidIngredients[0], "Lanolin");
  assert.ok(r.avoidIngredients.every((x) => x.length <= LIMITS.ingredientLen));
  assert.equal(r.region, null); assert.equal(r.breastfeeding, null);
  assert.equal("extra" in r, false);
});

test("sanitize — খালি/null ইনপুটে নিরাপদ ডিফল্ট", () => {
  for (const x of [null, undefined, {}]) {
    const r = sanitizeCarePrefs(x);
    assert.equal(r.v, 1); assert.deepEqual(r.skinConcerns, []); assert.deepEqual(r.avoidIngredients, []);
  }
  assert.equal(sanitizeCarePrefs({ avoidIngredients: new Array(50).fill(0).map((_, i) => "i" + i) }).avoidIngredients.length, LIMITS.avoidIngredients);
});

test("client enum ও firestore.rules-এর carePrefsOk হুবহু মেলে", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const fn = rules.slice(rules.indexOf("function carePrefsOk"));
  const body = fn.slice(0, fn.indexOf("\n    }\n"));
  const found = {};
  for (const m of body.matchAll(/d\.(\w+) in \[([^\]]*)\]/g)) found[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const m of body.matchAll(/d\.(\w+)\.hasOnly\(\[([^\]]*)\]\)/g)) found[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const k of Object.keys(ENUMS)) assert.deepEqual([...(found[k] || [])].sort(), [...ENUMS[k]].sort(), k);
});
