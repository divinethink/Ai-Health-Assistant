// আজকের ডোজ-গ্রিড helper। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { shortMedName, groupDosesByTime, homeVisibleDoses } from "../../src/health/summary/doseGroups.js";

test("shortMedName: ফর্ম-প্রিফিক্স ও জেনেরিক আলাদা", () => {
  assert.deepEqual(shortMedName("Cap. DDR 30 mg (Dexlansoprazole)"), { main: "DDR 30 mg", sub: "Dexlansoprazole" });
  assert.deepEqual(shortMedName("Tab. Alve 60 mg"), { main: "Alve 60 mg", sub: "" });
  assert.deepEqual(shortMedName("Probio 4 billion"), { main: "Probio 4 billion", sub: "" });
  assert.deepEqual(shortMedName("Cap."), { main: "Cap.", sub: "" });
  assert.deepEqual(shortMedName(""), { main: "", sub: "" });
});
test("groupDosesByTime: সময়ে গ্রুপ, ক্রম ঠিক", () => {
  const g = groupDosesByTime([{ time: "20:00", key: "a" }, { time: "08:00", key: "b" }, { time: "20:00", key: "c" }]);
  assert.deepEqual(g.map((x) => [x.time, x.items.length]), [["08:00", 1], ["20:00", 2]]);
});
test("homeVisibleDoses: দেরি + পরের স্লট; খাওয়া বাদ", () => {
  const d = [
    { key: "1", time: "08:00", taken: true, due: true },
    { key: "2", time: "08:00", taken: false, due: true },
    { key: "3", time: "14:00", taken: false, due: false },
    { key: "4", time: "20:00", taken: false, due: false },
  ];
  assert.deepEqual(homeVisibleDoses(d).map((x) => x.key), ["2", "3"]);
  assert.deepEqual(homeVisibleDoses([{ key: "1", time: "08:00", taken: true, due: true }]), []);
  assert.deepEqual(homeVisibleDoses([]), []);
});
