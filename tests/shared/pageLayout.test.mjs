// পেজ-কার্ড কাস্টমাইজ pure logic। চালান: node --test tests/shared/pageLayout.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PAGE_DEFS, defaultPage, sanitizePage, sanitizeCards, moveCard, updateCard, sameLayout, cardTitle } from "../../src/shared/pageLayout.js";

test("ডকে কিছু না থাকলে ডিফল্ট = বর্তমান ক্রম, সব দৃশ্যমান, fixed", () => {
  const p = sanitizePage("home", null);
  assert.deepEqual(p.main.map((c) => c.id), PAGE_DEFS.home.zones.main.cards.map((c) => c.id));
  assert.ok(p.main.every((c) => c.visible && c.fold === "fixed"));
  assert.deepEqual(sanitizePage("trend", undefined), defaultPage("trend"));
});
test("সেভ-করা ক্রম/লুকানো/ভাঁজ মানা হয়", () => {
  const raw = { home: { main: [{ id: "week", visible: false, fold: "closed" }, { id: "hero", visible: true, fold: "open" }] } };
  const p = sanitizePage("home", raw).main;
  assert.equal(p[0].id, "week"); assert.equal(p[0].visible, false); assert.equal(p[0].fold, "closed");
  const h = p.find((c) => c.id === "hero");
  assert.equal(h.fold, "open"); assert.ok(p.indexOf(h) > 0); // সেভ-করা ক্রম: week আগে, hero পরে
  assert.equal(p.length, PAGE_DEFS.home.zones.main.cards.length); // বাকি কার্ড ফেরে
});
test("অচেনা/ডুপ্লিকেট/ভুল-মান কার্ড বাদ, বাকি অক্ষত", () => {
  const raw = [{ id: "x", visible: true, fold: "open" }, { id: "hero", visible: true, fold: "open" }, { id: "hero", visible: false, fold: "closed" }, { id: "week", visible: "yes", fold: "open" }, null, 5];
  const out = sanitizeCards("home", "main", raw);
  assert.equal(out.filter((c) => c.id === "hero").length, 1);
  assert.equal(out.find((c) => c.id === "hero").fold, "open");
  assert.equal(out.find((c) => c.id === "week").visible, true); // ভুল-মান → ডিফল্ট
  assert.ok(!out.some((c) => c.id === "x"));
});
test("নতুন কার্ড ঠিক আগের পরিচিত কার্ডের পরে বসে", () => {
  const raw = [{ id: "hero", visible: true, fold: "fixed" }, { id: "alert", visible: true, fold: "fixed" }];
  const out = sanitizeCards("home", "main", raw).map((c) => c.id);
  assert.deepEqual(out.slice(0, 4), ["hero", "macros", "alert", "rings"]);
});
test("raw অবৈধ ধরন হলে ডিফল্ট", () => {
  assert.deepEqual(sanitizePage("trend", "oops"), defaultPage("trend"));
  assert.deepEqual(sanitizePage("trend", { trend: [1, 2] }), defaultPage("trend"));
  assert.deepEqual(sanitizePage("nope", {}), {});
});
test("moveCard সীমায় অপরিবর্তিত, নতুন অ্যারে", () => {
  const l = defaultPage("trend").week;
  assert.deepEqual(moveCard(l, l[0].id, -1).map((c) => c.id), l.map((c) => c.id));
  assert.equal(moveCard(l, l[0].id, 1)[1].id, l[0].id);
  assert.notEqual(moveCard(l, l[0].id, 1), l);
});
test("updateCard/sameLayout/cardTitle", () => {
  const l = defaultPage("home").main;
  const u = updateCard(l, "hero", { fold: "closed" });
  assert.equal(u.find((c) => c.id === "hero").fold, "closed");
  assert.equal(sameLayout(l, defaultPage("home").main), true);
  assert.equal(sameLayout(l, u), false);
  assert.equal(cardTitle("trend", "week", "review"), "সাপ্তাহিক রিভিউ");
});
