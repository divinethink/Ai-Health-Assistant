// Health Assistant — Firestore Rules Unit Tests
// Architecture Plan §3.4.7 অনুযায়ী: ৬টা মূল কেস + Thread-31 audit-fix সংশ্লিষ্ট ৩টা নতুন কেস = মোট ৯টা।
// চালানোর নিয়ম: npm run test:rules  (Firebase Emulator নিজে থেকেই চালু/বন্ধ হয়)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteField,
} from 'firebase/firestore';

const FAMILY_ID = 'fam1';
const ADMIN_UID = 'admin-uid-1';

function sha256Hex(plain) {
  return createHash('sha256').update(plain).digest('hex');
}

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-health-assistant',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

// সহায়ক: rules বাইপাস করে সরাসরি seed data লেখা
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedFamily(familyId, adminUids) {
  await seed(async (db) => {
    await setDoc(doc(db, 'families', familyId), {
      familyId,
      familyCodeDisplay: 'TEST',
      createdBy: adminUids[0] || 'nobody',
      createdAt: new Date(),
      adminUids,
      firstAdminUid: adminUids[0] || null,
    });
  });
}

async function seedMember(familyId, memberId, data) {
  await seed(async (db) => {
    await setDoc(doc(db, 'families', familyId, 'members', memberId), {
      id: memberId,
      familyId,
      name: 'Test',
      dob: '1990-01-01',
      sex: 'male',
      role: 'self-managing',
      relationshipLabel: null,
      guardianMemberIds: [],
      bloodGroup: null,
      ownerUids: [],
      ownerActivity: {},
      updatedAt: new Date(),
      ...data,
    });
  });
}

async function seedPrivateKey(familyId, memberId, plainKey) {
  await seed(async (db) => {
    await setDoc(
      doc(db, 'families', familyId, 'members', memberId, 'private', 'key'),
      {
        key: plainKey,
        keyHash: sha256Hex(plainKey),
        createdBy: 'admin',
        createdAt: new Date(),
      }
    );
  });
}

async function seedUidIndex(familyId, uid, memberId) {
  await seed(async (db) => {
    await setDoc(doc(db, 'families', familyId, 'uidMemberIndex', uid), {
      memberId,
    });
  });
}

async function seedGrant(familyId, targetMemberId, granteeMemberId, status = 'approved') {
  await seed(async (db) => {
    await setDoc(
      doc(db, 'families', familyId, 'accessGrants', `${targetMemberId}_${granteeMemberId}`),
      {
        granterId: targetMemberId,
        granteeId: granteeMemberId,
        scope: 'read+write',
        relationshipType: 'other',
        status,
        revocable: true,
        grantedAt: new Date(),
        createdAt: new Date(),
      }
    );
  });
}

await test('setup: base family + admin', async () => {
  await seedFamily(FAMILY_ID, [ADMIN_UID]);
  await seedMember(FAMILY_ID, 'memberAdmin', { role: 'admin', ownerUids: [ADMIN_UID] });
});

// ============================================================
// 1. Self-profile edit / Admin edit
// ============================================================
await test('1. Self-profile edit — owner নিজের প্রোফাইল edit করতে পারবেন', async () => {
  await seedMember(FAMILY_ID, 'memberSelf', { ownerUids: ['uidSelf'] });
  const ref = doc(dbAs('uidSelf'), 'families', FAMILY_ID, 'members', 'memberSelf');
  await assertSucceeds(updateDoc(ref, { name: 'Updated Name' }));
});

await test('1b. Self-profile edit — অন্য (non-owner, non-admin) কেউ পারবেন না', async () => {
  await seedMember(FAMILY_ID, 'memberSelf2', { ownerUids: ['uidSelf2'] });
  const ref = doc(dbAs('uidRandom'), 'families', FAMILY_ID, 'members', 'memberSelf2');
  await assertFails(updateDoc(ref, { name: 'Hacked' }));
});

await test('1c. Admin edit — Admin অন্য সদস্যের non-ownerUids field edit করতে পারবেন', async () => {
  await seedMember(FAMILY_ID, 'memberByAdmin', { ownerUids: ['uidOther'] });
  const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberByAdmin');
  await assertSucceeds(updateDoc(ref, { relationshipLabel: 'father' }));
});

// ============================================================
// 2. Direct-Identify claim (সঠিক hash দিয়ে)
// ============================================================
await test('2. Direct-Identify claim — সঠিক hash দিয়ে unclaimed profile claim করা যাবে', async () => {
  await seedMember(FAMILY_ID, 'memberClaim', { ownerUids: [] });
  await seedPrivateKey(FAMILY_ID, 'memberClaim', 'correctKey123');
  const ref = doc(dbAs('uidClaimer'), 'families', FAMILY_ID, 'members', 'memberClaim');
  await assertSucceeds(
    updateDoc(ref, {
      ownerUids: ['uidClaimer'],
      ownerActivity: { uidClaimer: Date.now() },
      claimKeyHashAttempt: sha256Hex('correctKey123'),
    })
  );
});

await test('2b. Direct-Identify claim — ভুল hash দিয়ে reject হবে', async () => {
  await seedMember(FAMILY_ID, 'memberClaim2', { ownerUids: [] });
  await seedPrivateKey(FAMILY_ID, 'memberClaim2', 'correctKey456');
  const ref = doc(dbAs('uidClaimer2'), 'families', FAMILY_ID, 'members', 'memberClaim2');
  await assertFails(
    updateDoc(ref, {
      ownerUids: ['uidClaimer2'],
      ownerActivity: { uidClaimer2: Date.now() },
      claimKeyHashAttempt: sha256Hex('wrongKey'),
    })
  );
});

// ============================================================
// 3. FIFO eviction (৩ device পূর্ণ অবস্থায় ৪র্থ claim)
// ============================================================
await test('3. FIFO eviction — ৩ device পূর্ণ থাকা অবস্থায় ৪র্থ claim ঠিকভাবে ১টা evict করলে allow', async () => {
  await seedMember(FAMILY_ID, 'memberFifo', {
    role: 'self-managing',
    ownerUids: ['u1', 'u2', 'u3'],
  });
  await seedPrivateKey(FAMILY_ID, 'memberFifo', 'fifoKey123');
  const ref = doc(dbAs('u4'), 'families', FAMILY_ID, 'members', 'memberFifo');
  await assertSucceeds(
    updateDoc(ref, {
      ownerUids: ['u2', 'u3', 'u4'], // u1 FIFO-evicted, ঠিক ১টাই বদলেছে
      ownerActivity: { u2: 1, u3: 2, u4: 3 },
      claimKeyHashAttempt: sha256Hex('fifoKey123'),
    })
  );
});

await test('3b. FIFO eviction — একসাথে ১-এর বেশি device বদলালে reject', async () => {
  await seedMember(FAMILY_ID, 'memberFifo2', {
    role: 'self-managing',
    ownerUids: ['v1', 'v2', 'v3'],
  });
  await seedPrivateKey(FAMILY_ID, 'memberFifo2', 'fifoKey456');
  const ref = doc(dbAs('v4'), 'families', FAMILY_ID, 'members', 'memberFifo2');
  await assertFails(
    updateDoc(ref, {
      ownerUids: ['v4', 'v5', 'v6'], // ২টা extra evict — invalid
      ownerActivity: { v4: 1, v5: 2, v6: 3 },
      claimKeyHashAttempt: sha256Hex('fifoKey456'),
    })
  );
});

// ============================================================
// 4. Cross-member unauthorized write reject
// ============================================================
await test('4. Cross-member unauthorized write — grant/relation ছাড়া অন্য সদস্যের healthRecord লেখা যাবে না', async () => {
  await seedMember(FAMILY_ID, 'memberE', { ownerUids: ['uidE'] });
  await seedMember(FAMILY_ID, 'memberZ', { ownerUids: ['uidZ'] });
  const db = dbAs('uidZ');
  await assertFails(
    setDoc(doc(db, 'families', FAMILY_ID, 'healthRecords', 'rec1'), {
      memberId: 'memberE',
      resourceType: 'condition',
      lastEditedByMemberId: 'memberZ',
      name: 'Fever',
      updatedAt: new Date(),
      createdAt: new Date(),
    })
  );
});

// ============================================================
// 5. hasAccess() positive/negative case
// ============================================================
await test('5. hasAccess() negative — approved grant না থাকলে read reject', async () => {
  await seedUidIndex(FAMILY_ID, 'uidZ', 'memberZ');
  await seed(async (db) => {
    await setDoc(doc(db, 'families', FAMILY_ID, 'healthRecords', 'recNeg'), {
      memberId: 'memberE',
      resourceType: 'condition',
      lastEditedByMemberId: 'memberE',
      name: 'Fever',
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  });
  const ref = doc(dbAs('uidZ'), 'families', FAMILY_ID, 'healthRecords', 'recNeg');
  await assertFails(getDoc(ref));
});

await test('5b. hasAccess() positive — approved AccessGrant থাকলে read+write allow', async () => {
  await seedGrant(FAMILY_ID, 'memberE', 'memberZ', 'approved');
  const db = dbAs('uidZ');

  // read
  const readRef = doc(db, 'families', FAMILY_ID, 'healthRecords', 'recNeg');
  await assertSucceeds(getDoc(readRef));

  // write (create)
  await assertSucceeds(
    setDoc(doc(db, 'families', FAMILY_ID, 'healthRecords', 'recPos'), {
      memberId: 'memberE',
      resourceType: 'observation',
      lastEditedByMemberId: 'memberZ',
      value: '98.6',
      updatedAt: new Date(),
      createdAt: new Date(),
    })
  );
});

// ============================================================
// 6. (Audit-fix) claim-cleanup — claimKeyHashAttempt মোছা সফল হওয়া
// ============================================================
await test('6. claim-cleanup — claim সফল হওয়ার পর owner claimKeyHashAttempt মুছতে পারবেন', async () => {
  await seedMember(FAMILY_ID, 'memberCleanup', {
    ownerUids: ['uidCleanup'],
    claimKeyHashAttempt: 'leftover-hash-value',
  });
  const ref = doc(dbAs('uidCleanup'), 'families', FAMILY_ID, 'members', 'memberCleanup');
  await assertSucceeds(updateDoc(ref, { claimKeyHashAttempt: deleteField() }));
});

// ============================================================
// 7. (Audit-fix) admin ownerUids: add → reject, remove → allow
// ============================================================
await test('7. admin ownerUids ADD — নতুন uid verification ছাড়া admin যোগ করতে পারবেন না', async () => {
  await seedMember(FAMILY_ID, 'memberAddTest', { ownerUids: ['uidG'] });
  const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberAddTest');
  await assertFails(updateDoc(ref, { ownerUids: ['uidG', 'uidNewIntruder'] }));
});

await test('7b. admin ownerUids REMOVE — admin device-revoke (shrink) করতে পারবেন', async () => {
  await seedMember(FAMILY_ID, 'memberRemoveTest', { ownerUids: ['uidH1', 'uidH2'] });
  const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberRemoveTest');
  await assertSucceeds(updateDoc(ref, { ownerUids: ['uidH1'] }));
});

// ============================================================
// 8. (Audit-fix) non-admin familyCode-create reject, new-family-moment allow
// ============================================================
await test('8. familyCode create — established family-তে non-admin reject হবে', async () => {
  const ref = doc(dbAs('uidNonAdmin'), 'familyCodes', 'BLOCKEDCODE');
  await assertFails(
    setDoc(ref, {
      familyId: FAMILY_ID,
      createdBy: 'uidNonAdmin',
      createdAt: new Date(),
    })
  );
});

await test('8b. familyCode create — নতুন family তৈরির মুহূর্তে (adminUids empty) allow হবে', async () => {
  await seedFamily('famNew', []); // adminUids: [] — এখনো কেউ claim করেননি
  const ref = doc(dbAs('uidNewFamily'), 'familyCodes', 'NEWFAMCODE');
  await assertSucceeds(
    setDoc(ref, {
      familyId: 'famNew',
      createdBy: 'uidNewFamily',
      createdAt: new Date(),
    })
  );
});
