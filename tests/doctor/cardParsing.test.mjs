// চালানো: node --test tests/doctor/cardParsing.test.mjs  (synthetic টেক্সট — আসল কার্ডের নমুনা নয়)
import test from "node:test";
import assert from "node:assert/strict";
import { parseVisitingCard } from "../../src/health/doctor-details/cardParsing.js";

test("ইংরেজি কার্ড: সব ফিল্ড", () => {
  const r = parseVisitingCard(`Dr. Md. Rahim Uddin
MBBS, FCPS (Medicine)
Consultant, Cardiology
Square Hospital Ltd.
Chamber: House 12, Road 5, Dhanmondi, Dhaka-1205
Sat-Thu 5pm - 9pm
Appointment: 01712-345678`);
  assert.equal(r.name, "Dr. Md. Rahim Uddin");
  assert.equal(r.specialtyCategory, "cardiology-neurology");
  assert.equal(r.phone, "01712345678");
  assert.equal(r.hospital, "Square Hospital Ltd.");
  assert.match(r.chamberAddress, /House 12, Road 5, Dhanmondi/);
  assert.equal(r.area, "ধানমন্ডি, ঢাকা");
});
test("বাংলা কার্ড: বাংলা অঙ্কের ফোন, ডা. উপসর্গ", () => {
  const r = parseVisitingCard(`ডা. করিম আহমেদ
শিশু ও নবজাতক বিশেষজ্ঞ
ল্যাবএইড হাসপাতাল
ঠিকানা: বাড়ি ১, রোড ৪, ধানমন্ডি, ঢাকা
মোবাইল: ০১৭১১-২২৩৩৪৪`);
  assert.equal(r.name, "ডা. করিম আহমেদ");
  assert.equal(r.specialtyCategory, "pediatrics-neonatology");
  assert.equal(r.phone, "01711223344");
  assert.equal(r.hospital, "ল্যাবএইড হাসপাতাল");
  assert.ok(r.area.includes("ধানমন্ডি"));
});
test("+880 ফরম্যাট ফোন → 01…", () => {
  assert.equal(parseVisitingCard("Dr. A B\n+880 1912 345678").phone, "01912345678");
});
test("উপসর্গ ছাড়া নাম: প্রথম দিকের নাম-সদৃশ লাইন; ঝাপসা/অর্থহীন টেক্সটে কিছু বানায় না", () => {
  assert.equal(parseVisitingCard("Salma Akter\nSkin & VD Specialist\n01811112222").name, "Salma Akter");
  const junk = parseVisitingCard("#$ ~~ 12\n|||\nxx");
  assert.deepEqual([junk.name, junk.phone, junk.hospital, junk.chamberAddress, junk.specialtyCategory, junk.area], ["", "", "", "", "", ""]);
  assert.deepEqual(parseVisitingCard("").found, []);
  assert.deepEqual(parseVisitingCard(null).found, []);
});
test("ক্যাটেগরি: নির্দিষ্ট আগে 'medicine'-এর", () => {
  assert.equal(parseVisitingCard("Dr. X Y\nInternal Medicine & Diabetes Specialist").specialtyCategory, "endocrinology-diabetology");
  assert.equal(parseVisitingCard("Dr. X Y\nMedicine Specialist").specialtyCategory, "medicine");
  assert.equal(parseVisitingCard("Dr. X Y\nENT & Head-Neck Surgeon").specialtyCategory, "dermatology-ophthalmology-ent-dentistry");
  assert.equal(parseVisitingCard("Dr. X Y\nGeneral Surgeon").specialtyCategory, "gastro-hepatology-general-surgery");
});
test("ডিগ্রি নামে ঢোকে না; সময়ের লাইন ঠিকানায় ঢোকে না", () => {
  const r = parseVisitingCard("Prof. Dr. Nasir Uddin, MBBS, FCPS\nRoad 3, Mirpur\nSat-Thu 4pm-8pm");
  assert.equal(r.name, "Prof. Dr. Nasir Uddin");
  assert.equal(r.chamberAddress, "Road 3, Mirpur");
});
