// Audit-fix (২০ নভেম্বর ২০২৬): orphaned status, lastActiveAt, app_stats-এর কড়া নিয়ম।
import test, { before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc, deleteField, Timestamp } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dailytask-audit",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "families/famA"), {
      familyId: "famA", familyCode: "FAMILYA1", createdByUid: "uidA", schemaVersion: 2,
      adminUids: ["uidA"], dataCollectionName: "data_FAMILYA1", migrationState: "v2", identityModel: "google-only",
    });
    await setDoc(doc(db, "families/famA/members/m1"), { name: "A", googleUid: "uidA", role: "admin" });
    await setDoc(doc(db, "families/famA/members/m2"), { name: "C", googleUid: "uidC", role: "member" });
    await setDoc(doc(db, "users/uidC"), { familyId: "famA", memberId: "m2" });
  });
});
const as = (uid) => env.authenticatedContext(uid).firestore();

test("বাইরের ইউজার অন্য পরিবারকে orphaned করতে পারে না", async () => {
  await assertFails(updateDoc(doc(as("uidX"), "families/famA"), { status: "orphaned", orphanedAt: 1, updatedAt: 1 }));
});
test("সাধারণ সদস্য পরিবারকে orphaned করতে পারে না, admin পারে", async () => {
  await assertFails(updateDoc(doc(as("uidC"), "families/famA"), { status: "orphaned", orphanedAt: 1, updatedAt: 1 }));
  await assertSucceeds(updateDoc(doc(as("uidA"), "families/famA"), { status: "orphaned", orphanedAt: 1, updatedAt: 1 }));
});
test("orphaned পরিবার বাইরের ইউজার পুনরুদ্ধার করতে পারে না, admin পারে", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "families/famA"), { status: "orphaned", orphanedAt: 1 });
  });
  await assertFails(setDoc(doc(as("uidX"), "families/famA"), { updatedAt: 2 }, { merge: true }));
  await assertSucceeds(updateDoc(doc(as("uidA"), "families/famA"), { status: deleteField(), orphanedAt: deleteField() }));
});
test("lastActiveAt: Timestamp চলে, সংখ্যা/অবজেক্ট চলে না", async () => {
  await assertSucceeds(updateDoc(doc(as("uidC"), "families/famA"), { lastActiveAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(as("uidC"), "families/famA"), { lastActiveAt: 12345 }));
  await assertFails(updateDoc(doc(as("uidC"), "families/famA"), { lastActiveAt: { a: "x".repeat(1000) } }));
});
test("app_stats: শুধু pwa_installs, count +১", async () => {
  const db = as("uidX");
  await assertSucceeds(setDoc(doc(db, "app_stats/pwa_installs"), { count: 1, lastInstalledAt: Date.now() }));
  await assertSucceeds(setDoc(doc(db, "app_stats/pwa_installs"), { count: 2, lastInstalledAt: Date.now() }, { merge: true }));
  await assertFails(setDoc(doc(db, "app_stats/pwa_installs"), { count: 999, lastInstalledAt: Date.now() }, { merge: true }));
  await assertFails(setDoc(doc(db, "app_stats/other"), { count: 1, lastInstalledAt: Date.now() }));
  await assertSucceeds(getDoc(doc(db, "app_stats/pwa_installs")));
});
