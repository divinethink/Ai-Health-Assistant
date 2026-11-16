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
