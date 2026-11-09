// localISO — UTC নয়, লোকাল তারিখ দেয় (ধাপ ১)। চালান: node --test tests/shared/*.test.mjs
process.env.TZ = "Asia/Dhaka";
import test from "node:test";
import assert from "node:assert/strict";
import { localISO } from "../../src/shared/dates.js";

test("ঢাকার ভোর ০২:০০ — UTC-তে আগের দিন, localISO-তে সঠিক দিন", () => {
  const d = new Date("2026-11-09T20:00:00Z"); // ঢাকা: ১০ নভে ০২:০০
  assert.equal(d.toISOString().slice(0, 10), "2026-11-09");
  assert.equal(localISO(d), "2026-11-10");
});
test("মাস/দিন ২ অঙ্কে পূরণ", () => {
  assert.equal(localISO(new Date(2026, 0, 5, 12)), "2026-01-05");
});
test("আর্গুমেন্ট ছাড়া আজকের তারিখ ফরম্যাট ঠিক", () => {
  assert.match(localISO(), /^\d{4}-\d{2}-\d{2}$/);
});
