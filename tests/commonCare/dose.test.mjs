import test from "node:test";
import assert from "node:assert/strict";
import { HOMEO_DOSE, HERBAL_DOSE, HERBAL_DOSE_GENERAL, DOSE_DISCLAIMER } from "../../src/health/commonCare/commonCareDose.js";
import { COMMON_HERBAL_DEFAULTS } from "../../src/health/commonCare/commonCareHerbalList.js";

const bad = /কার্যকর|নিরাময়|প্রমাণিত|সারায়|সমাধান/;
test("ভেষজ: প্রতি এন্ট্রির মাত্রা আছে; শিশু-এন্ট্রিতে child; অচেনা key নেই", () => {
  const keys = new Set(COMMON_HERBAL_DEFAULTS.map((d) => d.key));
  for (const k of Object.keys(HERBAL_DOSE)) assert.ok(keys.has(k), "অচেনা key: " + k);
  for (const d of COMMON_HERBAL_DEFAULTS) {
    const x = HERBAL_DOSE[d.key];
    assert.ok(x && (x.adult || x.child), "মাত্রা নেই: " + d.key);
    if (d.kid) assert.ok(x.child, "শিশু-মাত্রা নেই: " + d.key);
    assert.ok(!bad.test((x.adult || "") + (x.child || "")), "দাবি: " + d.key);
  }
});
test("হোমিও সাধারণ কার্ড: বড়ো/শিশু/২ বছরের নিচে আছে; দাবি-ভাষা নেই", () => {
  const t = HOMEO_DOSE.lines.join(" ");
  assert.ok(/বড়ো/.test(t) && /শিশু/.test(t) && /২ বছরের নিচে/.test(t));
  assert.ok(!bad.test(t + HERBAL_DOSE_GENERAL.lines.join(" ")));
  assert.ok(DOSE_DISCLAIMER.includes("প্রেসক্রিপশন নয়"));
});
