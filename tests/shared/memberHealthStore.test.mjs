// memberHealthStore — শেয়ার্ড cache (ধাপ ১)। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  getMemberRecords, invalidateMemberHealth, clearMemberHealthCache, subscribeMemberHealth, TTL_MS,
} from "../../src/health/records/memberHealthStore.js";

function counter(records = [{ id: "a" }]) {
  const f = () => { f.calls++; return Promise.resolve(records); };
  f.calls = 0;
  return f;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("TTL-এর মধ্যে দ্বিতীয় পাঠ cache থেকে — fetch একবারই", async () => {
  clearMemberHealthCache();
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m1", f);
  assert.equal(f.calls, 1);
});

test("TTL পেরোলে আবার fetch", async () => {
  clearMemberHealthCache();
  const f = counter();
  let t = 1000;
  await getMemberRecords("f1", "m1", f, { now: () => t });
  t += TTL_MS + 1;
  await getMemberRecords("f1", "m1", f, { now: () => t });
  assert.equal(f.calls, 2);
});

test("fresh:true cache এড়ায় ও cache আপডেট করে", async () => {
  clearMemberHealthCache();
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m1", f, { fresh: true });
  assert.equal(f.calls, 2);
  await getMemberRecords("f1", "m1", f);
  assert.equal(f.calls, 2);
});

test("একই সময়ে দুই কল — একটাই fetch (in-flight dedupe)", async () => {
  clearMemberHealthCache();
  const d = deferred();
  let calls = 0;
  const f = () => { calls++; return d.promise; };
  const p1 = getMemberRecords("f1", "m1", f);
  const p2 = getMemberRecords("f1", "m1", f);
  d.resolve([{ id: "x" }]);
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});

test("ভিন্ন সদস্য/পরিবারের cache আলাদা", async () => {
  clearMemberHealthCache();
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m2", f);
  await getMemberRecords("f2", "m1", f);
  assert.equal(f.calls, 3);
});

test("invalidate (সদস্য) — শুধু ওই সদস্যের cache মোছে", async () => {
  clearMemberHealthCache();
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m2", f);
  invalidateMemberHealth("f1", "m1");
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m2", f);
  assert.equal(f.calls, 3);
});

test("invalidate (পরিবার) — পরিবারের সব সদস্যের cache মোছে, অন্য পরিবার নয়", async () => {
  clearMemberHealthCache();
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m2", f);
  await getMemberRecords("f2", "m1", f);
  invalidateMemberHealth("f1");
  await getMemberRecords("f1", "m1", f);
  await getMemberRecords("f1", "m2", f);
  await getMemberRecords("f2", "m1", f);
  assert.equal(f.calls, 5);
});

test("চলমান পুরনো fetch-এর ফল invalidate-এর পর cache-এ ঢোকে না", async () => {
  clearMemberHealthCache();
  const d = deferred();
  const old = () => d.promise;
  const p = getMemberRecords("f1", "m1", old);
  invalidateMemberHealth("f1", "m1");           // লেখা হয়ে গেল
  d.resolve([{ id: "stale" }]);
  await p;
  const fresh = counter([{ id: "new" }]);
  const r = await getMemberRecords("f1", "m1", fresh);
  assert.equal(fresh.calls, 1);                  // পুরনো (stale) ফল cache হয়নি
  assert.equal(r[0].id, "new");
});

test("পুরনো ধীর fetch নতুন fetch-এর ফল ওভাররাইট করে না", async () => {
  clearMemberHealthCache();
  const dOld = deferred();
  const pOld = getMemberRecords("f1", "m1", () => dOld.promise);
  const pNew = getMemberRecords("f1", "m1", () => Promise.resolve([{ id: "new" }]), { fresh: true });
  await pNew;
  dOld.resolve([{ id: "old" }]);
  await pOld;
  const f = counter();
  const r = await getMemberRecords("f1", "m1", f);
  assert.equal(f.calls, 0);
  assert.equal(r[0].id, "new");
});

test("fetch ব্যর্থ হলে error ফেরে ও cache হয় না", async () => {
  clearMemberHealthCache();
  await assert.rejects(getMemberRecords("f1", "m1", () => Promise.reject(new Error("boom"))), /boom/);
  const f = counter();
  await getMemberRecords("f1", "m1", f);
  assert.equal(f.calls, 1);
});

test("প্রতিবার আলাদা array ফেরে — কলার sort/push করলে cache নষ্ট হয় না", async () => {
  clearMemberHealthCache();
  const f = counter([{ id: "a" }, { id: "b" }]);
  const r1 = await getMemberRecords("f1", "m1", f);
  r1.reverse(); r1.push({ id: "junk" });
  const r2 = await getMemberRecords("f1", "m1", f);
  assert.deepEqual(r2.map((x) => x.id), ["a", "b"]);
});

test("subscribe: invalidate ও clear-এ ইভেন্ট আসে; unsubscribe-এর পর আসে না", () => {
  clearMemberHealthCache();
  const seen = [];
  const off = subscribeMemberHealth((e) => seen.push(e));
  invalidateMemberHealth("f1", "m1");
  invalidateMemberHealth("f1");
  clearMemberHealthCache();
  assert.deepEqual(seen, [
    { familyId: "f1", memberId: "m1" },
    { familyId: "f1", memberId: null },
    { familyId: null, memberId: null },
  ]);
  off();
  invalidateMemberHealth("f1", "m1");
  assert.equal(seen.length, 3);
});
