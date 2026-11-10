// ধাপ ১০ (গ২) "এরপর কী?" pure হিসাব। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { extractFollowUpDate, courseEndPlan, foodMedNoteItems, doctorNoteSummary, addDays, shortHash, followUpEventId, courseEndEventId, doctorVisitEventId } from "../../src/health/nextstep/nextStepCalc.js";

const TODAY = "2026-11-10";

test("ফলো-আপ: দিন/মাস/বছর (DD/MM/YYYY) ও বাংলা অঙ্ক", () => {
  const a = extractFollowUpDate("Advice: rest\nFollow up: 17/11/2026", TODAY);
  assert.equal(a.date, "2026-11-17"); assert.equal(a.relative, false);
  assert.equal(extractFollowUpDate("ফলো-আপ: ১৭-১১-২০২৬", TODAY).date, "2026-11-17");
});

test("ফলো-আপ: মাসের নাম (ইংরেজি/বাংলা) ও বছর-ছাড়া", () => {
  assert.equal(extractFollowUpDate("Next visit: 17 Nov 2026", TODAY).date, "2026-11-17");
  assert.equal(extractFollowUpDate("পুনরায় সাক্ষাৎ: ১৭ নভেম্বর ২০২৬", TODAY).date, "2026-11-17");
  assert.equal(extractFollowUpDate("Follow-up 5 Dec", TODAY).date, "2026-12-05");
  assert.equal(extractFollowUpDate("Follow-up 5 Nov", TODAY).date, "2027-11-05"); // বছর নেই + পেরিয়ে গেছে → আগামী বছর
});

test("ফলো-আপ: দ্বিতীয় সংখ্যা ১২-র বেশি হলে মাস/দিন উল্টে; ISO", () => {
  assert.equal(extractFollowUpDate("Follow up 11/17/2026", TODAY).date, "2026-11-17");
  assert.equal(extractFollowUpDate("Follow up 2026-12-01", TODAY).date, "2026-12-01");
});

test("ফলো-আপ: তারিখ পরের লাইনে থাকলেও ধরে", () => {
  assert.equal(extractFollowUpDate("Follow up\n20/11/2026", TODAY).date, "2026-11-20");
});

test("ফলো-আপ: আপেক্ষিক ('৭ দিন পর', 'after 2 weeks') → relative=true, আজ থেকে গোনা", () => {
  const a = extractFollowUpDate("৭ দিন পর ফলো-আপ", TODAY);
  assert.equal(a.date, "2026-11-17"); assert.equal(a.relative, true);
  assert.equal(extractFollowUpDate("Follow up after 2 weeks", TODAY).date, "2026-11-24");
});

test("ফলো-আপ: পুরনো তারিখ, অযৌক্তিক দূরের তারিখ, অবৈধ তারিখ, কী-শব্দ নেই → null", () => {
  assert.equal(extractFollowUpDate("Follow up 01/01/2026", TODAY), null);
  assert.equal(extractFollowUpDate("Follow up 01/01/2031", TODAY), null);
  assert.equal(extractFollowUpDate("Follow up 31/11/2026", TODAY), null);
  assert.equal(extractFollowUpDate("Tab. Napa 17/11/2026", TODAY), null);
  assert.equal(extractFollowUpDate("", TODAY), null);
  assert.equal(extractFollowUpDate(null, TODAY), null);
});

test("ফলো-আপ: ওষুধের লাইনের তারিখ ধরে না (শুধু কী-শব্দের লাইন)", () => {
  const t = "Tab. Napa 500mg 1+1+1 5 days\nFollow up: 20 Nov 2026";
  assert.equal(extractFollowUpDate(t, TODAY).date, "2026-11-20");
});

test("courseEndPlan: ≥৪ দিন ও সেভ-হওয়া ওষুধ; শেষের ২ দিন আগে; আজ+(দিন−১) সূত্র", () => {
  const plan = courseEndPlan([{ name: "Pantoprazole", days: 7 }, { name: "Napa", days: 3 }, { name: "X", days: null }, { name: "Skipped", days: 10 }], ["Pantoprazole", "Napa", "X"], TODAY);
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0], { name: "Pantoprazole", days: 7, endDate: "2026-11-16", remindDate: "2026-11-14" });
});

test("courseEndPlan: খালি/অবৈধ ইনপুটে নিরাপদ", () => {
  assert.deepEqual(courseEndPlan(null, null, TODAY), []);
  assert.deepEqual(courseEndPlan([{ name: "A", days: 4 }], ["A"], TODAY), [{ name: "A", days: 4, endDate: "2026-11-13", remindDate: "2026-11-11" }]);
});

test("foodMedNoteItems: বিদ্যমান ৩ নিয়ম থেকেই; অন্য ওষুধে খালি", () => {
  assert.deepEqual(foodMedNoteItems(["Metformin", "Pantoprazole"]), []);
  const t = foodMedNoteItems(["Levothyroxine"]);
  assert.equal(t.length, 1); assert.equal(t[0].rule, "thyroid"); assert.match(t[0].text, /ডাক্তার\/ফার্মাসিস্টের নির্দেশমতো/);
  assert.deepEqual(foodMedNoteItems(null), []);
});

test("doctorNoteSummary: শুধু নাম+দিক, মান নয়; খালিতে null", () => {
  assert.equal(doctorNoteSummary([]), null); assert.equal(doctorNoteSummary(null), null);
  const s = doctorNoteSummary([{ name: "TSH", level: "high", value: "8.2" }, { name: "Dengue NS1", level: "positive", value: "Positive" }]);
  assert.equal(s.count, 2); assert.deepEqual(s.names, ["TSH বেশি", "Dengue NS1 (Positive)"]);
  assert.ok(!s.names.join().includes("8.2"));
});

test("doc-ID নির্দিষ্ট (idempotent) ও নিরাপদ অক্ষর", () => {
  assert.equal(followUpEventId("m1", "2026-11-17"), "ns_fu_m1_2026-11-17");
  assert.equal(doctorVisitEventId("m1", "2026-11-13"), "ns_dr_m1_2026-11-13");
  const a = courseEndEventId("m1", "Pantoprazole 40mg", "2026-11-16");
  assert.equal(a, courseEndEventId("m1", "  pantoprazole 40MG ", "2026-11-16"));
  assert.match(a, /^ns_end_m1_[0-9a-z]+_2026-11-16$/);
  assert.notEqual(shortHash("Napa"), shortHash("Metformin"));
});

test("addDays: মাস/বছর পেরোনো", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-11-10", -2), "2026-11-08");
});
