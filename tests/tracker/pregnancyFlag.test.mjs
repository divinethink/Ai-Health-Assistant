// চালানো: node --test tests/tracker/pregnancyFlag.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PREGNANCY_NAME_RE, PREGNANCY_CONDITION_NAME, pregnancyRecordsOf, effectivePregnant, safetyGate } from "../../src/health/tracker/trackerCalc.js";

const cond = (name, status = "active") => ({ id: name, resourceType: "condition", name, status });

test("নাম-মিল: বাংলা/ইংলিশ মেলে, সম্পর্কহীন নাম মেলে না", () => {
  [PREGNANCY_CONDITION_NAME, "গর্ভাবস্থা", "গর্ভবতী", "Pregnancy", "Breastfeeding", "lactating", "বুকের দুধ খাওয়াচ্ছি"].forEach((n) => assert.ok(PREGNANCY_NAME_RE.test(n), n));
  ["গর্ভাশয়ের সিস্ট", "ডায়াবেটিস", "Hypertension", "বুকে ব্যথা"].forEach((n) => assert.ok(!PREGNANCY_NAME_RE.test(n), n));
});

test("effectivePregnant: রেকর্ড-সত্য, নইলে পুরনো টগল", () => {
  assert.equal(effectivePregnant(null, []), false);
  assert.equal(effectivePregnant({ flags: { pregnant: true } }, []), true);                              // স্থানান্তরের আগে সুরক্ষা বজায়
  assert.equal(effectivePregnant({ flags: { pregnant: true } }, [cond(PREGNANCY_CONDITION_NAME)]), true);
  assert.equal(effectivePregnant({ flags: { pregnant: true } }, [cond(PREGNANCY_CONDITION_NAME, "resolved")]), false); // স্থানান্তরের পর বন্ধ করা যায়
  assert.equal(effectivePregnant(null, [cond("গর্ভাবস্থা", "chronic")]), true);
  assert.equal(effectivePregnant(null, [cond("ডায়াবেটিস")]), false);
  assert.equal(pregnancyRecordsOf([{ resourceType: "allergy", name: "গর্ভবতী" }, cond("গর্ভবতী")]).length, 1);
});

test("সেফটি-গেট: গর্ভবতী হলে ক্যালরি-টার্গেট বন্ধ", () => {
  assert.equal(safetyGate({ age: 30, flags: { pregnant: effectivePregnant(null, [cond(PREGNANCY_CONDITION_NAME)]) } }).blocked, true);
  assert.equal(safetyGate({ age: 30, flags: { pregnant: effectivePregnant(null, [cond(PREGNANCY_CONDITION_NAME, "resolved")]) } }).blocked, false);
});
