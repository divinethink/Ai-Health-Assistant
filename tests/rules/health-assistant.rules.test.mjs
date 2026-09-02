// Health Assistant — Firestore Rules Unit Tests (Mocha)
// Architecture Plan §3.4.7 অনুযায়ী: ৬টা মূল কেস + Thread-31 audit-fix সংশ্লিষ্ট ৩টা নতুন কেস = মোট ৯টা।
// চালানোর নিয়ম: npm run test:rules  (Firebase Emulator নিজে থেকেই চালু/বন্ধ হয়)
//
// node:test-এর বদলে Mocha ব্যবহার করা হয়েছে — Firebase JS SDK-এর emulator-connection
// (gRPC/WebChannel) সম্পূর্ণ close না হওয়ায় Node-এর built-in test runner-এ
// "Promise resolution is still pending" error আসছিল। Firebase নিজেও official
// rules-unit-testing ডকুমেন্টেশনে Mocha সুপারিশ করে — এই সমস্যা এড়াতে।

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
  collection,
  getDocs,
} from 'firebase/firestore';

const FAMILY_ID = 'fam1';
const ADMIN_UID = 'admin-uid-1';

function sha256Hex(plain) {
  return createHash('sha256').update(plain).digest('hex');
}

let testEnv;

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

describe('Health Assistant — Firestore Rules', function () {
  this.timeout(20000);

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-health-assistant',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
    await seedFamily(FAMILY_ID, [ADMIN_UID]);
    await seedMember(FAMILY_ID, 'memberAdmin', { role: 'admin', ownerUids: [ADMIN_UID] });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  // ============================================================
  // 1. Self-profile edit / Admin edit
  // ============================================================
  it('1. Self-profile edit — owner নিজের প্রোফাইল edit করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'memberSelf', { ownerUids: ['uidSelf'] });
    const ref = doc(dbAs('uidSelf'), 'families', FAMILY_ID, 'members', 'memberSelf');
    await assertSucceeds(updateDoc(ref, { name: 'Updated Name' }));
  });

  it('1b. Self-profile edit — অন্য (non-owner, non-admin) কেউ পারবেন না', async () => {
    await seedMember(FAMILY_ID, 'memberSelf2', { ownerUids: ['uidSelf2'] });
    const ref = doc(dbAs('uidRandom'), 'families', FAMILY_ID, 'members', 'memberSelf2');
    await assertFails(updateDoc(ref, { name: 'Hacked' }));
  });

  it('1c. Admin edit — Admin অন্য সদস্যের non-ownerUids field edit করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'memberByAdmin', { ownerUids: ['uidOther'] });
    const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberByAdmin');
    await assertSucceeds(updateDoc(ref, { relationshipLabel: 'father' }));
  });

  // ============================================================
  // 2. Direct-Identify claim (সঠিক hash দিয়ে)
  // ============================================================
  it('2. Direct-Identify claim — সঠিক hash দিয়ে unclaimed profile claim করা যাবে', async () => {
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

  it('2b. Direct-Identify claim — ভুল hash দিয়ে reject হবে', async () => {
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
  it('3. FIFO eviction — ৩ device পূর্ণ থাকা অবস্থায় ৪র্থ claim ঠিকভাবে ১টা evict করলে allow', async () => {
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

  it('3b. FIFO eviction — একসাথে ১-এর বেশি device বদলালে reject', async () => {
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
  it('4. Cross-member unauthorized write — grant/relation ছাড়া অন্য সদস্যের healthRecord লেখা যাবে না', async () => {
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
  it('5. hasAccess() negative — approved grant না থাকলে read reject', async () => {
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

  it('5b. hasAccess() positive — approved AccessGrant থাকলে read+write allow', async () => {
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
  it('6. claim-cleanup — claim সফল হওয়ার পর owner claimKeyHashAttempt মুছতে পারবেন', async () => {
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
  it('7. admin ownerUids ADD — নতুন uid verification ছাড়া admin যোগ করতে পারবেন না', async () => {
    await seedMember(FAMILY_ID, 'memberAddTest', { ownerUids: ['uidG'] });
    const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberAddTest');
    await assertFails(updateDoc(ref, { ownerUids: ['uidG', 'uidNewIntruder'] }));
  });

  it('7b. admin ownerUids REMOVE — admin device-revoke (shrink) করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'memberRemoveTest', { ownerUids: ['uidH1', 'uidH2'] });
    const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'members', 'memberRemoveTest');
    await assertSucceeds(updateDoc(ref, { ownerUids: ['uidH1'] }));
  });

  // ============================================================
  // 8. (Audit-fix) non-admin familyCode-create reject, new-family-moment allow
  // ============================================================
  it('8. familyCode create — established family-তে non-admin reject হবে', async () => {
    const ref = doc(dbAs('uidNonAdmin'), 'familyCodes', 'BLOCKEDCODE');
    await assertFails(
      setDoc(ref, {
        familyId: FAMILY_ID,
        createdBy: 'uidNonAdmin',
        createdAt: new Date(),
      })
    );
  });

  it('8b. familyCode create — নতুন family তৈরির মুহূর্তে (adminUids empty) allow হবে', async () => {
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

  // ============================================================
  // 9. (Thread 32 fix) isFamilyMember() — Direct-Identify-claimed সদস্য
  //    (accessRequests doc নেই, শুধু uidMemberIndex) সদস্য-তালিকা দেখতে পারবেন
  // ============================================================
  it('9. Direct-Identify-claimed সদস্য (uidMemberIndex, কোনো accessRequests নেই) members list করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'memberRaiyanLike', { ownerUids: ['uidRaiyanLike'] });
    await seedUidIndex(FAMILY_ID, 'uidRaiyanLike', 'memberRaiyanLike');
    const snap = await getDocs(collection(dbAs('uidRaiyanLike'), 'families', FAMILY_ID, 'members'));
    await assertSucceeds(Promise.resolve(snap));
  });

  it('9b. পুরোপুরি অপরিচিত uid (না admin, না accessRequests-approved, না uidMemberIndex) members list করতে পারবেন না', async () => {
    await assertFails(
      getDocs(collection(dbAs('uidTotalStranger'), 'families', FAMILY_ID, 'members'))
    );
  });

  // ============================================================
  // 10. AccessGrant — Take-Access request (grantee self-request, §3.5)
  // ============================================================
  it('10. AccessGrant create — grantee নিজে নিজের memberId দিয়ে pending request পাঠাতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'granterA', { ownerUids: ['uidGranterA'] });
    await seedMember(FAMILY_ID, 'granteeA', { ownerUids: ['uidGranteeA'] });
    await seedUidIndex(FAMILY_ID, 'uidGranteeA', 'granteeA');
    const ref = doc(dbAs('uidGranteeA'), 'families', FAMILY_ID, 'accessGrants', 'granterA_granteeA');
    await assertSucceeds(
      setDoc(ref, {
        granterId: 'granterA', granteeId: 'granteeA',
        scope: 'read+write', relationshipType: 'other',
        status: 'pending', revocable: true,
        createdAt: new Date(),
      })
    );
  });

  it('10b. AccessGrant create — granteeId স্পুফ করে অন্য সদস্যের নামে request পাঠানো যাবে না', async () => {
    await seedMember(FAMILY_ID, 'granterB', { ownerUids: ['uidGranterB'] });
    await seedMember(FAMILY_ID, 'granteeB', { ownerUids: ['uidGranteeB'] });
    await seedMember(FAMILY_ID, 'imposterB', { ownerUids: ['uidImposterB'] });
    const ref = doc(dbAs('uidImposterB'), 'families', FAMILY_ID, 'accessGrants', 'granterB_granteeB');
    await assertFails(
      setDoc(ref, {
        granterId: 'granterB', granteeId: 'granteeB', // caller-এর নিজের memberId না
        scope: 'read+write', relationshipType: 'other',
        status: 'pending', revocable: true,
        createdAt: new Date(),
      })
    );
  });

  // ============================================================
  // 11. AccessGrant — granter approve/deny
  // ============================================================
  it('11. AccessGrant approve — granter pending request approve করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'granterC', { ownerUids: ['uidGranterC'] });
    await seedMember(FAMILY_ID, 'granteeC', { ownerUids: ['uidGranteeC'] });
    await seedUidIndex(FAMILY_ID, 'uidGranterC', 'granterC');
    await seedGrant(FAMILY_ID, 'granterC', 'granteeC', 'pending');
    const ref = doc(dbAs('uidGranterC'), 'families', FAMILY_ID, 'accessGrants', 'granterC_granteeC');
    await assertSucceeds(updateDoc(ref, { status: 'approved', grantedAt: new Date() }));
  });

  it('11b. AccessGrant approve — granter ছাড়া অন্য কেউ decide করতে পারবেন না', async () => {
    await seedMember(FAMILY_ID, 'granterD', { ownerUids: ['uidGranterD'] });
    await seedMember(FAMILY_ID, 'granteeD', { ownerUids: ['uidGranteeD'] });
    await seedMember(FAMILY_ID, 'strangerD', { ownerUids: ['uidStrangerD'] });
    await seedGrant(FAMILY_ID, 'granterD', 'granteeD', 'pending');
    const ref = doc(dbAs('uidStrangerD'), 'families', FAMILY_ID, 'accessGrants', 'granterD_granteeD');
    await assertFails(updateDoc(ref, { status: 'approved', grantedAt: new Date() }));
  });

  // ============================================================
  // 12. AccessGrant — cancel approved (either side, revocable)
  // ============================================================
  it('12. AccessGrant cancel — approved grant granter/grantee যেকোনো পক্ষ cancel করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'granterE', { ownerUids: ['uidGranterE'] });
    await seedMember(FAMILY_ID, 'granteeE', { ownerUids: ['uidGranteeE'] });
    await seedUidIndex(FAMILY_ID, 'uidGranteeE', 'granteeE');
    await seedGrant(FAMILY_ID, 'granterE', 'granteeE', 'approved');
    const ref = doc(dbAs('uidGranteeE'), 'families', FAMILY_ID, 'accessGrants', 'granterE_granteeE');
    await assertSucceeds(
      updateDoc(ref, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'granteeE' })
    );
  });

  // ============================================================
  // 13. AccessGrant — re-request after denied/cancelled
  // ============================================================
  it('13. AccessGrant re-request — denied/cancelled থেকে grantee আবার pending করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'granterF', { ownerUids: ['uidGranterF'] });
    await seedMember(FAMILY_ID, 'granteeF', { ownerUids: ['uidGranteeF'] });
    await seedUidIndex(FAMILY_ID, 'uidGranteeF', 'granteeF');
    await seedGrant(FAMILY_ID, 'granterF', 'granteeF', 'denied');
    const ref = doc(dbAs('uidGranteeF'), 'families', FAMILY_ID, 'accessGrants', 'granterF_granteeF');
    await assertSucceeds(updateDoc(ref, { status: 'pending' }));
  });

  // ============================================================
  // 14. Structural (Admin) Parent-Child(<18) grant — create
  // ============================================================
  it('14. Structural grant create — Admin parent-child(<18) approved+non-revocable grant তৈরি করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'childA', { ownerUids: [] });
    await seedMember(FAMILY_ID, 'guardianA', { ownerUids: ['uidGuardianA'] });
    const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'accessGrants', 'childA_guardianA');
    await assertSucceeds(
      setDoc(ref, {
        granterId: 'childA', granteeId: 'guardianA',
        scope: 'read+write', relationshipType: 'parent-child',
        status: 'approved', revocable: false,
        grantedAt: new Date(), createdAt: new Date(),
      })
    );
  });

  it('14b. Structural grant create — non-admin structural (parent-child) grant তৈরি করতে পারবেন না', async () => {
    await seedMember(FAMILY_ID, 'childB', { ownerUids: [] });
    await seedMember(FAMILY_ID, 'guardianB', { ownerUids: ['uidGuardianB'] });
    const ref = doc(dbAs('uidGuardianB'), 'families', FAMILY_ID, 'accessGrants', 'childB_guardianB');
    await assertFails(
      setDoc(ref, {
        granterId: 'childB', granteeId: 'guardianB',
        scope: 'read+write', relationshipType: 'parent-child',
        status: 'approved', revocable: false,
        grantedAt: new Date(), createdAt: new Date(),
      })
    );
  });

  // ============================================================
  // 15. Structural grant — Admin cancel (non-revocable)
  // ============================================================
  it('15. Structural grant cancel — Admin non-revocable parent-child grant cancel করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'childC', { ownerUids: [] });
    await seedMember(FAMILY_ID, 'guardianC', { ownerUids: ['uidGuardianC'] });
    await seed(async (db) => {
      await setDoc(doc(db, 'families', FAMILY_ID, 'accessGrants', 'childC_guardianC'), {
        granterId: 'childC', granteeId: 'guardianC',
        scope: 'read+write', relationshipType: 'parent-child',
        status: 'approved', revocable: false,
        grantedAt: new Date(), createdAt: new Date(),
      });
    });
    const ref = doc(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'accessGrants', 'childC_guardianC');
    await assertSucceeds(
      updateDoc(ref, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'admin' })
    );
  });

  it('15b. Structural grant cancel — non-admin (guardian নিজেও) non-revocable grant cancel করতে পারবেন না', async () => {
    await seedMember(FAMILY_ID, 'childD', { ownerUids: [] });
    await seedMember(FAMILY_ID, 'guardianD', { ownerUids: ['uidGuardianD'] });
    await seed(async (db) => {
      await setDoc(doc(db, 'families', FAMILY_ID, 'accessGrants', 'childD_guardianD'), {
        granterId: 'childD', granteeId: 'guardianD',
        scope: 'read+write', relationshipType: 'parent-child',
        status: 'approved', revocable: false,
        grantedAt: new Date(), createdAt: new Date(),
      });
    });
    const ref = doc(dbAs('uidGuardianD'), 'families', FAMILY_ID, 'accessGrants', 'childD_guardianD');
    await assertFails(
      updateDoc(ref, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'guardianD' })
    );
  });

  // ============================================================
  // 16. Notification — create scope ও targetUid-based read isolation (§3.5.2)
  // ============================================================
  it('16. Notification create — family member valid targetUid (uidMemberIndex-এ আছে) এর জন্য notification তৈরি করতে পারবেন', async () => {
    await seedMember(FAMILY_ID, 'notifTargetMember', { ownerUids: ['uidNotifTarget'] });
    await seedUidIndex(FAMILY_ID, 'uidNotifTarget', 'notifTargetMember');
    const ref = doc(collection(dbAs(ADMIN_UID), 'families', FAMILY_ID, 'notifications'));
    await assertSucceeds(
      setDoc(ref, {
        targetUid: 'uidNotifTarget', type: 'access-grant-request',
        message: 'test', read: false, createdAt: new Date(),
      })
    );
  });

  it('16b. Notification read — শুধু targetUid নিজেই তার notification পড়তে পারবেন, অন্য কেউ না', async () => {
    let notifId;
    await seed(async (db) => {
      const ref = doc(collection(db, 'families', FAMILY_ID, 'notifications'));
      notifId = ref.id;
      await setDoc(ref, {
        targetUid: 'uidNotifOwner', type: 'access-grant-request',
        message: 'test', read: false, createdAt: new Date(),
      });
    });
    const ref = doc(dbAs('uidSomeoneElse'), 'families', FAMILY_ID, 'notifications', notifId);
    await assertFails(getDoc(ref));
  });
});
