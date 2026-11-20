import test from "node:test";
import assert from "node:assert/strict";
import { GUIDES, guideForCondition } from "../../src/health/records/conditionGuideData.js";
import { conditionKeysOf, avoidFor } from "../../src/health/tracker/avoidRules.js";
import { detectFlagsFromConditions } from "../../src/health/tracker/trackerCalc.js";
import { guideStatus } from "../../src/health/tracker/exerciseGuide.js";
import { matchDietGuidanceForTags } from "../../src/health/nutrition-fitness/dietGuidanceData.js";
import { tagLabel } from "../../src/health/nutrition-fitness/tagLabels.js";

const id = (n) => (guideForCondition(n) || {}).id;
const rec = (name) => ({ resourceType: "condition", name, status: "active" });

test("নতুন রোগের নাম → সঠিক গাইড", () => {
  const cases = {
    "Osteoarthritis": "osteoarthritis", "হাঁটুর ক্ষয়": "osteoarthritis",
    "Rheumatoid arthritis": "rheumatoid", "রিউমাটয়েড আর্থ্রাইটিস": "rheumatoid",
    "বাত": "arthritis", "Arthritis": "arthritis", "Gout": "gout",
    "Fibroadenoma": "breast-benign", "Breast cyst": "breast-benign", "Intraductal papilloma": "breast-benign", "স্তনের টিউমার": "breast-benign",
    "UTI": "uti", "মূত্রনালির সংক্রমণ": "uti", "Kidney stone": "kidney-stone", "কিডনিতে পাথর": "kidney-stone",
    "BPH": "bph", "প্রোস্টেট গ্রন্থি বড়": "bph", "Prostatitis": "prostatitis",
    "Urinary incontinence": "incontinence", "প্রস্রাব ধরে রাখতে না পারা": "incontinence",
    "Erectile dysfunction": "ed", "Male infertility": "male-infertility", "শুক্রাণু কম": "male-infertility",
    "Pyelonephritis": "pyelonephritis", "কিডনির সংক্রমণ": "pyelonephritis",
    "Acute Kidney Injury": "aki", "AKI": "aki", "Glomerulonephritis": "glomerulonephritis",
    "Hydronephrosis": "hydronephrosis", "Polycystic Kidney Disease": "pkd",
    "কিডনিতে সিস্ট": "kidney-cyst-tumor", "Kidney tumor": "kidney-cyst-tumor",
    "CKD": "kidney", "কিডনি রোগ": "kidney", "কোষ্ঠকাঠিন্য": "constipation", "PCOS": undefined,
  };
  for (const [name, want] of Object.entries(cases)) assert.equal(id(name), want, name);
});

test("কিডনির উপধরন কিডনি-ফ্ল্যাগ ধরে (CKD-সতর্কতা)", () => {
  for (const n of ["Glomerulonephritis", "Pyelonephritis", "AKI", "Hydronephrosis", "Polycystic Kidney Disease", "কিডনি রোগ"])
    assert.equal(detectFlagsFromConditions([rec(n)]).kidney, true, n);
  assert.equal(detectFlagsFromConditions([rec("UTI")]).kidney, false);
  assert.equal(detectFlagsFromConditions([rec("BPH")]).kidney, false);
});

test("সতর্কতা-নিয়ম: খাবার ও ব্যায়াম", () => {
  const keys = (n) => conditionKeysOf([rec(n)]);
  assert.ok(keys("UTI").includes("urinary"));
  assert.ok(keys("BPH").includes("urinary") && keys("BPH").includes("prostate"));
  assert.ok(keys("Urinary incontinence").includes("incont"));
  assert.ok(keys("কিডনিতে পাথর").includes("stone"));
  assert.ok(keys("Rheumatoid arthritis").includes("joint") && keys("Gout").includes("joint"));
  const ids = (dom, n) => avoidFor(dom, { condKeys: keys(n) }).map((x) => x.id);
  assert.ok(ids("food", "UTI").includes("urinary-food"));
  assert.ok(ids("food", "Kidney stone").includes("stone-food"));
  assert.ok(ids("exercise", "Urinary incontinence").includes("incont-ex"));
  assert.ok(ids("exercise", "Rheumatoid arthritis").includes("joint-ex"));
  assert.ok(ids("exercise", "Prostatitis").includes("prostate-ex"));
  assert.equal(guideStatus("jacks", { condKeys: keys("Urinary incontinence") }).level, "yellow");
  assert.equal(guideStatus("cycling", { condKeys: keys("Prostatitis") }).level, "yellow");
  assert.equal(guideStatus("walk", { condKeys: keys("Urinary incontinence") }).level, "green");
});

test("খাদ্য-নির্দেশিকা ট্যাগ-লেবেল ও গাইডের সব অংশ", () => {
  for (const t of ["bph", "prostatitis", "breast lump", "arthritis", "pyelonephritis", "acute kidney injury", "polycystic kidney", "kidney cyst"])
    assert.notEqual(tagLabel(t).text, t, t);
  const out = matchDietGuidanceForTags([{ linkedTag: { type: "condition", value: "bph", aliases: ["প্রোস্টেট বড়"] }, avoidFoods: ["ক"], includeFoods: ["খ"] }], ["BPH"]);
  assert.deepEqual(out.avoidFoods, ["ক"]);
  assert.ok(GUIDES.every((g) => g.food.length && g.caution.length));
});
