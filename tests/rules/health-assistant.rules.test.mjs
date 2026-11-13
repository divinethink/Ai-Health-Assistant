// Health Assistant — Firestore Rules Unit Tests (Mocha)
// চালানো: npm run test:rules  (Firebase Emulator সহ)
//
// বর্তমান rules-এর (Google Sign-in মডেল: member.googleUid + uidMemberIndex) বিপরীতে লেখা।
// প্রতিটি টেস্টের আগে ডাটাবেস খালি করে ছোট বেস-ডেটা বসানো হয়, তাই টেস্টগুলো স্বাধীন।
// Mocha ব্যবহারের কারণ: Firebase SDK-র সাথে node:test-এ "Promise resolution is still pending" সমস্যা।

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, deleteField, collection, query, where } from 'firebase/firestore';

const FAMILY_ID = 'fam1';
const ADMIN_UID = 'admin-uid-1';
const OLD = new Date('2020-01-01T00:00:00Z');

let testEnv;

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

function dbAs(uid, token) {
  return testEnv.authenticatedContext(uid, token).firestore();
}

const famDoc = (db, ...path) => doc(db, 'families', FAMILY_ID, ...path);
const famCol = (db, ...path) => collection(db, 'families', FAMILY_ID, ...path);

async function seedFamily(familyId, adminUids, extra = {}) {
  await seed(async (db) => {
    await setDoc(doc(db, 'families', familyId), {
      familyId,
      familyCodeDisplay: 'TEST',
      createdBy: adminUids[0] || 'nobody',
      createdAt: OLD,
      adminUids,
      firstAdminUid: adminUids[0] || null,
      ...extra,
    });
  });
}

async function seedMember(memberId, data = {}) {
  await seed(async (db) => {
    await setDoc(famDoc(db, 'members', memberId), {
      id: memberId,
      familyId: FAMILY_ID,
      name: 'Test',
      dob: '1990-01-01',
      sex: 'male',
      role: 'self-managing',
      relationshipLabel: null,
      guardianMemberIds: [],
      googleUid: null,
      updatedAt: OLD,
      ...data,
    });
  });
}

async function seedUidIndex(uid, memberId) {
  await seed(async (db) => {
    await setDoc(famDoc(db, 'uidMemberIndex', uid), { memberId });
  });
}

// Google-লগইন করা সদস্য: member.googleUid + uidMemberIndex দুটোই
async function seedOwned(memberId, uid, data = {}) {
  await seedMember(memberId, { googleUid: uid, ...data });
  await seedUidIndex(uid, memberId);
}

async function seedGrant(targetMemberId, granteeMemberId, opts = {}) {
  await seed(async (db) => {
    await setDoc(famDoc(db, 'accessGrants', `${targetMemberId}_${granteeMemberId}`), {
      granterId: targetMemberId,
      granteeId: granteeMemberId,
      scope: 'read+write',
      relationshipType: 'other',
      status: 'approved',
      revocable: true,
      grantedAt: OLD,
      createdAt: OLD,
      ...opts,
    });
  });
}

async function seedShare(ownerId, granteeId, flags) {
  await seed(async (db) => {
    await setDoc(famDoc(db, 'profileShares', `${ownerId}_${granteeId}`), {
      ownerId,
      granteeId,
      read: false,
      write: false,
      updatedAt: OLD,
      ...flags,
    });
  });
}

async function seedRecord(id, memberId) {
  await seed(async (db) => {
    await setDoc(famDoc(db, 'healthRecords', id), {
      id,
      memberId,
      resourceType: 'condition',
      name: 'Test condition',
      lastEditedByMemberId: memberId,
      createdAt: OLD,
      updatedAt: OLD,
    });
  });
}

const newRecord = (memberId, editedBy, extra = {}) => ({
  memberId,
  resourceType: 'condition',
  name: 'New condition',
  lastEditedByMemberId: editedBy,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

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
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedFamily(FAMILY_ID, [ADMIN_UID]);
    await seedOwned('memberAdmin', ADMIN_UID, { role: 'admin' });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  // ============================================================
  describe('1. Member profile edit', () => {
    it('1. owner (googleUid) নিজের প্রোফাইল edit করতে পারেন', async () => {
      await seedOwned('mA', 'uidA');
      await assertSucceeds(updateDoc(famDoc(dbAs('uidA'), 'members', 'mA'), { name: 'নতুন নাম' }));
    });

    it('1b. non-owner, non-admin অন্যের প্রোফাইল edit করতে পারেন না', async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
      await assertFails(updateDoc(famDoc(dbAs('uidB'), 'members', 'mA'), { name: 'হ্যাক' }));
    });

    it('1c. owner নিজের role বদলাতে পারেন না (Admin-only)', async () => {
      await seedOwned('mA', 'uidA');
      await assertFails(updateDoc(famDoc(dbAs('uidA'), 'members', 'mA'), { role: 'admin' }));
    });

    it('1d. Admin অন্যের guardianMemberIds/relationshipLabel বদলাতে পারেন', async () => {
      await seedOwned('mA', 'uidA');
      await assertSucceeds(
        updateDoc(famDoc(dbAs(ADMIN_UID), 'members', 'mA'), {
          guardianMemberIds: ['memberAdmin'],
          relationshipLabel: 'son',
        })
      );
    });

    it('1e. owner নিজে guardianMemberIds বদলাতে পারেন না', async () => {
      await seedOwned('mA', 'uidA');
      await assertFails(
        updateDoc(famDoc(dbAs('uidA'), 'members', 'mA'), { guardianMemberIds: ['mA'] })
      );
    });

    it('1f. Admin-ও claim-করা সদস্যের googleUid বদলাতে পারেন না', async () => {
      await seedOwned('mA', 'uidA');
      await assertFails(updateDoc(famDoc(dbAs(ADMIN_UID), 'members', 'mA'), { googleUid: 'uidX' }));
    });

    it('1g. Admin নতুন সদস্য তৈরি করতে পারেন; non-admin পারেন না', async () => {
      await seedOwned('mA', 'uidA');
      const data = { name: 'Child', dob: '2018-01-01', sex: 'male', role: 'guardian-managed' };
      await assertSucceeds(setDoc(famDoc(dbAs(ADMIN_UID), 'members', 'mNew'), data));
      await assertFails(setDoc(famDoc(dbAs('uidA'), 'members', 'mNew2'), data));
    });
  });

  // ============================================================
  describe('2. Email-match auto-claim', () => {
    it('2. email মিললে unclaimed সদস্য claim করা যায় (email মুছে যায়)', async () => {
      await seedMember('mC', { email: 'a@x.com', googleUid: null });
      await assertSucceeds(
        updateDoc(famDoc(dbAs('uidC', { email: 'a@x.com' }), 'members', 'mC'), {
          googleUid: 'uidC',
          email: deleteField(),
          updatedAt: new Date(),
        })
      );
    });

    it('2b. ভুল email হলে claim reject', async () => {
      await seedMember('mC', { email: 'a@x.com', googleUid: null });
      await assertFails(
        updateDoc(famDoc(dbAs('uidC', { email: 'other@x.com' }), 'members', 'mC'), {
          googleUid: 'uidC',
          email: deleteField(),
          updatedAt: new Date(),
        })
      );
    });

    it('2c. ইতিমধ্যে claim-করা সদস্য অন্য কেউ আবার claim করতে পারে না', async () => {
      await seedMember('mC', { email: 'a@x.com', googleUid: 'uidOwner' });
      await assertFails(
        updateDoc(famDoc(dbAs('uidEvil', { email: 'a@x.com' }), 'members', 'mC'), {
          googleUid: 'uidEvil',
          email: deleteField(),
          updatedAt: new Date(),
        })
      );
    });
  });

  // ============================================================
  describe('3. Invite-link self-join', () => {
    const joinData = (uid, token, extra = {}) => ({
      name: 'New',
      dob: '1995-05-05',
      sex: 'female',
      role: 'self-managing',
      googleUid: uid,
      inviteTokenAttempt: token,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    });

    async function setToken(revoked) {
      await seed(async (db) => {
        await setDoc(
          doc(db, 'families', FAMILY_ID),
          { activeInviteToken: { token: 'tok123', revoked } },
          { merge: true }
        );
      });
    }

    it('3. সঠিক invite token দিয়ে self-join করা যায়', async () => {
      await setToken(false);
      await assertSucceeds(
        setDoc(famDoc(dbAs('uidNew'), 'members', 'mNew'), joinData('uidNew', 'tok123'))
      );
    });

    it('3b. ভুল token reject', async () => {
      await setToken(false);
      await assertFails(
        setDoc(famDoc(dbAs('uidNew'), 'members', 'mNew'), joinData('uidNew', 'wrong'))
      );
    });

    it('3c. role: admin দিয়ে self-join reject (privilege-escalation)', async () => {
      await setToken(false);
      await assertFails(
        setDoc(
          famDoc(dbAs('uidNew'), 'members', 'mNew'),
          joinData('uidNew', 'tok123', { role: 'admin' })
        )
      );
    });

    it('3d. revoked token দিয়ে join reject', async () => {
      await setToken(true);
      await assertFails(
        setDoc(famDoc(dbAs('uidNew'), 'members', 'mNew'), joinData('uidNew', 'tok123'))
      );
    });

    it('3e. অন্যের googleUid বসিয়ে join reject', async () => {
      await setToken(false);
      await assertFails(
        setDoc(famDoc(dbAs('uidNew'), 'members', 'mNew'), joinData('uidOther', 'tok123'))
      );
    });
  });

  // ============================================================
  describe('4. uidMemberIndex ও users', () => {
    it('4. নিজের (googleUid-মেলা) সদস্যের জন্য index বানানো যায়', async () => {
      await seedMember('mA', { googleUid: 'uidA' });
      await assertSucceeds(setDoc(famDoc(dbAs('uidA'), 'uidMemberIndex', 'uidA'), { memberId: 'mA' }));
    });

    it('4b. অন্যের সদস্যের দিকে index spoof reject', async () => {
      await seedMember('mA', { googleUid: 'uidA' });
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'uidMemberIndex', 'uidB'), { memberId: 'mA' }));
    });

    it('4c. অন্য uid-র নামে index বানানো reject', async () => {
      await seedMember('mA', { googleUid: 'uidA' });
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'uidMemberIndex', 'uidA'), { memberId: 'mA' }));
    });

    it('4d. users/{uid} শুধু নিজের সদস্যের দিকে বানানো যায়', async () => {
      await seedMember('mA', { googleUid: 'uidA' });
      await assertSucceeds(
        setDoc(doc(dbAs('uidA'), 'users', 'uidA'), { familyId: FAMILY_ID, memberId: 'mA' })
      );
      await assertFails(
        setDoc(doc(dbAs('uidB'), 'users', 'uidB'), { familyId: FAMILY_ID, memberId: 'mA' })
      );
    });
  });

  // ============================================================
  describe('5. familyCodes', () => {
    const codeData = (uid, familyId) => ({ familyId, createdBy: uid, createdAt: new Date() });

    it('5. established family-তে non-admin code বানাতে পারেন না', async () => {
      await assertFails(
        setDoc(doc(dbAs('stranger'), 'familyCodes', 'ABC123'), codeData('stranger', FAMILY_ID))
      );
    });

    it('5b. নতুন family (adminUids খালি) বা অস্তিত্বহীন family-র code বানানো যায়', async () => {
      await seedFamily('famNew', []);
      await assertSucceeds(
        setDoc(doc(dbAs('founder'), 'familyCodes', 'NEWFAM1'), codeData('founder', 'famNew'))
      );
      await assertSucceeds(
        setDoc(doc(dbAs('founder'), 'familyCodes', 'GHOST12'), codeData('founder', 'famGhost'))
      );
    });

    it('5c. নিজের family-র জন্য Admin code বানাতে পারেন', async () => {
      await assertSucceeds(
        setDoc(doc(dbAs(ADMIN_UID), 'familyCodes', 'ADMIN12'), codeData(ADMIN_UID, FAMILY_ID))
      );
    });

    it('5d. createdBy অন্যের uid হলে reject', async () => {
      await assertFails(
        setDoc(doc(dbAs('founder'), 'familyCodes', 'SPOOF12'), codeData('someoneElse', 'famGhost'))
      );
    });
  });

  // ============================================================
  describe('6. Family doc / adminUids', () => {
    it('6. নতুন family তৈরি + প্রথম admin হওয়া', async () => {
      const db = dbAs('founder');
      await assertSucceeds(
        setDoc(doc(db, 'families', 'famF'), {
          familyId: 'famF',
          familyCodeDisplay: 'FF',
          createdBy: 'founder',
          createdAt: new Date(),
          adminUids: [],
        })
      );
      await assertSucceeds(
        updateDoc(doc(db, 'families', 'famF'), {
          adminUids: ['founder'],
          firstAdminUid: 'founder',
          updatedAt: new Date(),
        })
      );
    });

    it('6b. non-admin established family-তে নিজেকে admin বানাতে পারেন না', async () => {
      await assertFails(
        updateDoc(doc(dbAs('intruder'), 'families', FAMILY_ID), {
          adminUids: [ADMIN_UID, 'intruder'],
          updatedAt: new Date(),
        })
      );
    });

    it('6c. Admin আরেকজন admin যোগ করতে পারেন', async () => {
      await assertSucceeds(
        updateDoc(doc(dbAs(ADMIN_UID), 'families', FAMILY_ID), {
          adminUids: [ADMIN_UID, 'admin2'],
          updatedAt: new Date(),
        })
      );
    });

    it('6d. firstAdmin অন্য admin-কে সরাতে পারেন; অন্য admin firstAdmin-কে সরাতে পারেন না', async () => {
      await seedFamily('famAdm', ['adminA', 'adminB']);
      await assertFails(
        updateDoc(doc(dbAs('adminB'), 'families', 'famAdm'), {
          adminUids: ['adminB'],
          updatedAt: new Date(),
        })
      );
      await assertSucceeds(
        updateDoc(doc(dbAs('adminA'), 'families', 'famAdm'), {
          adminUids: ['adminA'],
          updatedAt: new Date(),
        })
      );
    });

    it('6e. শেষ admin-কে সরানো যায় না (অন্তত ১জন থাকতে হবে)', async () => {
      await assertFails(
        updateDoc(doc(dbAs(ADMIN_UID), 'families', FAMILY_ID), {
          adminUids: [],
          updatedAt: new Date(),
        })
      );
    });

    it('6f. Admin invite token বদলাতে পারেন; non-admin পারেন না', async () => {
      await seedOwned('mA', 'uidA');
      const tok = { activeInviteToken: { token: 't1', revoked: false }, updatedAt: new Date() };
      await assertSucceeds(updateDoc(doc(dbAs(ADMIN_UID), 'families', FAMILY_ID), tok));
      await assertFails(updateDoc(doc(dbAs('uidA'), 'families', FAMILY_ID), tok));
    });
  });

  // ============================================================
  describe('7. Health records — hasAccess', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
    });

    it('7. owner নিজের record তৈরি, পড়া, edit ও delete করতে পারেন', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(famDoc(db, 'healthRecords', 'r1'), newRecord('mA', 'mA')));
      await assertSucceeds(getDoc(famDoc(db, 'healthRecords', 'r1')));
      await assertSucceeds(
        updateDoc(famDoc(db, 'healthRecords', 'r1'), { name: 'Edited', lastEditedByMemberId: 'mA' })
      );
      await assertSucceeds(deleteDoc(famDoc(db, 'healthRecords', 'r1')));
    });

    it('7b. grant/share ছাড়া অন্য সদস্য পড়তে বা লিখতে পারেন না', async () => {
      await seedRecord('r1', 'mA');
      const db = dbAs('uidB');
      await assertFails(getDoc(famDoc(db, 'healthRecords', 'r1')));
      await assertFails(setDoc(famDoc(db, 'healthRecords', 'r2'), newRecord('mA', 'mB')));
    });

    it('7c. approved AccessGrant থাকলে read+write allow', async () => {
      await seedRecord('r1', 'mA');
      await seedGrant('mA', 'mB');
      const db = dbAs('uidB');
      await assertSucceeds(getDoc(famDoc(db, 'healthRecords', 'r1')));
      await assertSucceeds(setDoc(famDoc(db, 'healthRecords', 'r2'), newRecord('mA', 'mB')));
    });

    it('7d. pending/cancelled grant কোনো access দেয় না', async () => {
      await seedRecord('r1', 'mA');
      await seedGrant('mA', 'mB', { status: 'pending' });
      await assertFails(getDoc(famDoc(dbAs('uidB'), 'healthRecords', 'r1')));
    });

    it('7e. lastEditedByMemberId spoof করে অন্যের নামে লেখা reject', async () => {
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'healthRecords', 'r1'), newRecord('mA', 'mA')));
    });

    it('7f. অবৈধ resourceType reject', async () => {
      await assertFails(
        setDoc(famDoc(dbAs('uidA'), 'healthRecords', 'r1'), newRecord('mA', 'mA', { resourceType: 'bogus' }))
      );
    });

    it('7f-2. নিজের commonCare রেকর্ড (সাধারণ চিকিৎসা) তৈরি করা যায়', async () => {
      await assertSucceeds(
        setDoc(famDoc(dbAs('uidA'), 'healthRecords', 'cc1'), newRecord('mA', 'mA', { resourceType: 'commonCare', disease: 'জ্বর', brand: 'Napa' }))
      );
    });

    it('7f-3. অন্যের commonCare রেকর্ডে অনুমতি ছাড়া লেখা reject', async () => {
      await assertFails(
        setDoc(famDoc(dbAs('uidB'), 'healthRecords', 'cc2'), newRecord('mA', 'mB', { resourceType: 'commonCare', disease: 'জ্বর' }))
      );
    });

    it('7g. update-এ memberId বদলে অন্যের নামে সরানো reject', async () => {
      await seedRecord('r1', 'mA');
      await assertFails(
        updateDoc(famDoc(dbAs('uidA'), 'healthRecords', 'r1'), { memberId: 'mB', lastEditedByMemberId: 'mA' })
      );
    });

    it('7h. Admin যেকোনো সদস্যের record পড়তে, লিখতে ও delete করতে পারেন', async () => {
      await seedRecord('r1', 'mA');
      const db = dbAs(ADMIN_UID);
      await assertSucceeds(getDoc(famDoc(db, 'healthRecords', 'r1')));
      await assertSucceeds(
        setDoc(famDoc(db, 'healthRecords', 'r2'), newRecord('mA', 'memberAdmin'))
      );
      await assertSucceeds(deleteDoc(famDoc(db, 'healthRecords', 'r1')));
    });

    it('7i. non-owner অন্যের record delete করতে পারেন না', async () => {
      await seedRecord('r1', 'mA');
      await assertFails(deleteDoc(famDoc(dbAs('uidB'), 'healthRecords', 'r1')));
    });

    it('7j. অপরিচিত (সদস্য নয়) ব্যবহারকারী কিছুই পড়তে পারে না', async () => {
      await seedRecord('r1', 'mA');
      await assertFails(getDoc(famDoc(dbAs('stranger'), 'healthRecords', 'r1')));
    });
  });

  // ============================================================
  describe('8. ProfileShare (owner-controlled)', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
      await seedRecord('r1', 'mA');
    });

    it('8. owner নিজের প্রোফাইলের share বানাতে পারেন', async () => {
      await assertSucceeds(
        setDoc(famDoc(dbAs('uidA'), 'profileShares', 'mA_mB'), {
          ownerId: 'mA',
          granteeId: 'mB',
          read: true,
          write: false,
          updatedAt: new Date(),
        })
      );
    });

    it('8b. অন্যের প্রোফাইলের owner সেজে share বানানো reject', async () => {
      await assertFails(
        setDoc(famDoc(dbAs('uidB'), 'profileShares', 'mA_mB'), {
          ownerId: 'mA',
          granteeId: 'mB',
          read: true,
          write: true,
          updatedAt: new Date(),
        })
      );
    });

    it('8c. read share থাকলে পড়া যায়, কিন্তু লেখা যায় না', async () => {
      await seedShare('mA', 'mB', { read: true, write: false });
      const db = dbAs('uidB');
      await assertSucceeds(getDoc(famDoc(db, 'healthRecords', 'r1')));
      await assertFails(setDoc(famDoc(db, 'healthRecords', 'r2'), newRecord('mA', 'mB')));
    });

    it('8d. write share থাকলে লেখা যায়', async () => {
      await seedShare('mA', 'mB', { read: true, write: true });
      await assertSucceeds(setDoc(famDoc(dbAs('uidB'), 'healthRecords', 'r2'), newRecord('mA', 'mB')));
    });

    it('8e. grantee নিজে share বদলাতে পারেন না', async () => {
      await seedShare('mA', 'mB', { read: true, write: false });
      await assertFails(
        updateDoc(famDoc(dbAs('uidB'), 'profileShares', 'mA_mB'), { write: true, updatedAt: new Date() })
      );
    });

    it('8f. owner share বাতিল (delete) করতে পারেন', async () => {
      await seedShare('mA', 'mB', { read: true });
      await assertSucceeds(deleteDoc(famDoc(dbAs('uidA'), 'profileShares', 'mA_mB')));
    });
  });

  // ============================================================
  describe('9. AccessGrants (structural + legacy)', () => {
    beforeEach(async () => {
      await seedOwned('mChild', 'uidChild');
      await seedOwned('mParent', 'uidParent');
    });

    const structural = () => ({
      granterId: 'mChild',
      granteeId: 'mParent',
      scope: 'read+write',
      relationshipType: 'parent-child',
      status: 'approved',
      revocable: false,
      grantedAt: new Date(),
      createdAt: new Date(),
    });

    it('9. Admin structural parent-child grant বানাতে পারেন', async () => {
      await assertSucceeds(
        setDoc(famDoc(dbAs(ADMIN_UID), 'accessGrants', 'mChild_mParent'), structural())
      );
    });

    it('9b. non-admin (guardian নিজেও) structural grant বানাতে পারেন না', async () => {
      await assertFails(
        setDoc(famDoc(dbAs('uidParent'), 'accessGrants', 'mChild_mParent'), structural())
      );
    });

    it('9c. পুরনো pending peer-request এখন আর তৈরি করা যায় না', async () => {
      await assertFails(
        setDoc(famDoc(dbAs('uidParent'), 'accessGrants', 'mChild_mParent'), {
          granterId: 'mChild',
          granteeId: 'mParent',
          scope: 'read+write',
          relationshipType: 'other',
          status: 'pending',
          revocable: true,
          createdAt: new Date(),
        })
      );
    });

    it('9d. Admin non-revocable grant cancel করতে পারেন', async () => {
      await seedGrant('mChild', 'mParent', { relationshipType: 'parent-child', revocable: false });
      await assertSucceeds(
        updateDoc(famDoc(dbAs(ADMIN_UID), 'accessGrants', 'mChild_mParent'), {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'memberAdmin',
        })
      );
    });

    it('9e. non-admin non-revocable grant cancel করতে পারেন না', async () => {
      await seedGrant('mChild', 'mParent', { relationshipType: 'parent-child', revocable: false });
      await assertFails(
        updateDoc(famDoc(dbAs('uidParent'), 'accessGrants', 'mChild_mParent'), {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'mParent',
        })
      );
    });

    it('9f. Admin cancelled structural grant আবার approve করতে পারেন', async () => {
      await seedGrant('mChild', 'mParent', {
        relationshipType: 'parent-child',
        revocable: false,
        status: 'cancelled',
      });
      await assertSucceeds(
        updateDoc(famDoc(dbAs(ADMIN_UID), 'accessGrants', 'mChild_mParent'), {
          status: 'approved',
          grantedAt: new Date(),
        })
      );
    });

    it('9g. ১৮+ transition: Admin revocable false→true করতে পারেন', async () => {
      await seedGrant('mChild', 'mParent', { relationshipType: 'parent-child', revocable: false });
      await assertSucceeds(
        updateDoc(famDoc(dbAs(ADMIN_UID), 'accessGrants', 'mChild_mParent'), { revocable: true })
      );
    });

    it('9h. approved revocable peer-grant granter নিজে cancel করতে পারেন', async () => {
      await seedGrant('mChild', 'mParent', { revocable: true });
      await assertSucceeds(
        updateDoc(famDoc(dbAs('uidChild'), 'accessGrants', 'mChild_mParent'), {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'mChild',
        })
      );
    });

    it('9i. grant কখনো delete করা যায় না', async () => {
      await seedGrant('mChild', 'mParent', {});
      await assertFails(deleteDoc(famDoc(dbAs(ADMIN_UID), 'accessGrants', 'mChild_mParent')));
    });
  });

  // ============================================================
  describe('10. Notifications', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
    });

    const notif = (target) => ({
      targetUid: target,
      type: 'info',
      message: 'test',
      read: false,
      createdAt: new Date(),
    });

    it('10. পরিবারের সদস্য বৈধ targetUid-কে notification পাঠাতে পারেন', async () => {
      await assertSucceeds(setDoc(famDoc(dbAs('uidA'), 'notifications', 'n1'), notif('uidB')));
    });

    it('10b. uidMemberIndex-এ নেই এমন targetUid-তে পাঠানো reject', async () => {
      await assertFails(setDoc(famDoc(dbAs('uidA'), 'notifications', 'n1'), notif('ghostUid')));
    });

    it('10c. পরিবারের বাইরের কেউ notification পাঠাতে পারে না', async () => {
      await assertFails(setDoc(famDoc(dbAs('stranger'), 'notifications', 'n1'), notif('uidB')));
    });

    it('10d. শুধু targetUid নিজে পড়তে ও read-mark করতে পারেন', async () => {
      await seed(async (db) => {
        await setDoc(famDoc(db, 'notifications', 'n1'), { ...notif('uidB'), createdAt: OLD });
      });
      await assertFails(getDoc(famDoc(dbAs('uidA'), 'notifications', 'n1')));
      await assertFails(updateDoc(famDoc(dbAs('uidA'), 'notifications', 'n1'), { read: true }));
      await assertSucceeds(getDoc(famDoc(dbAs('uidB'), 'notifications', 'n1')));
      await assertSucceeds(updateDoc(famDoc(dbAs('uidB'), 'notifications', 'n1'), { read: true }));
    });
  });

  // ============================================================
  describe('12. Health tracker (healthTracker)', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
    });
    const tr = (memberId, editor, extra = {}) => ({
      type: 'daily', memberId, date: '2026-11-08', waterGlasses: 5, sources: { waterGlasses: 'manual' },
      lastEditedByMemberId: editor, createdAt: OLD, updatedAt: OLD, ...extra,
    });

    it('12. owner নিজের tracker doc তৈরি, পড়া (query), update ও delete করতে পারেন', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'daily_mA_2026-11-08'), tr('mA', 'mA')));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'daily_mA_2026-11-08'), { steps: 100, lastEditedByMemberId: 'mA' }, { merge: true }));
      await assertSucceeds(getDocs(query(famCol(db, 'healthTracker'), where('memberId', '==', 'mA'), where('date', '==', '2026-11-08'))));
      await assertSucceeds(deleteDoc(famDoc(db, 'healthTracker', 'daily_mA_2026-11-08')));
    });

    it('12b. grant ছাড়া অন্য সদস্য পড়তে/লিখতে পারেন না; approved grant থাকলে পারেন', async () => {
      await seed(async (db) => { await setDoc(famDoc(db, 'healthTracker', 't1'), tr('mA', 'mA')); });
      await assertFails(getDocs(query(famCol(dbAs('uidB'), 'healthTracker'), where('memberId', '==', 'mA'))));
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'healthTracker', 't2'), tr('mA', 'mB')));
      await seedGrant('mA', 'mB');
      await assertSucceeds(getDocs(query(famCol(dbAs('uidB'), 'healthTracker'), where('memberId', '==', 'mA'))));
      await assertSucceeds(setDoc(famDoc(dbAs('uidB'), 'healthTracker', 't3'), tr('mA', 'mB')));
    });

    it('12c. অবৈধ type, অজানা field ও lastEditedBy spoof reject', async () => {
      const db = dbAs('uidA');
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'x1'), tr('mA', 'mA', { type: 'bogus' })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'x2'), tr('mA', 'mA', { surprise: 1 })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'x3'), tr('mA', 'mB')));
    });

    it('12d. update-এ memberId বদলানো reject; non-owner delete reject', async () => {
      await seed(async (db) => { await setDoc(famDoc(db, 'healthTracker', 't1'), tr('mA', 'mA')); });
      await assertFails(updateDoc(famDoc(dbAs('uidA'), 'healthTracker', 't1'), { memberId: 'mB', lastEditedByMemberId: 'mA' }));
      await assertFails(deleteDoc(famDoc(dbAs('uidB'), 'healthTracker', 't1')));
    });

    // ধাপ B: নতুন ঐচ্ছিক ফিল্ড (planPrefs → goal; extraFoods/exerciseLog → daily)
    const goalDoc = (extra = {}) => tr('mA', 'mA', { type: 'goal', ...extra });
    const prefs = { v: 1, meal: { lunch: [{ food: 'rice', qty: 1 }] }, exercise: { 0: [{ type: 'walk', min: 30 }] } };

    it('12e. owner বৈধ planPrefs (goal), extraFoods ও exerciseLog (daily) লিখতে পারেন; খালি prefs-ও চলে', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goalDoc({ planPrefs: prefs })));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), { planPrefs: { v: 1, meal: {}, exercise: {} }, lastEditedByMemberId: 'mA' }, { merge: true }));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'daily_mA_2026-11-08'),
        tr('mA', 'mA', { extraFoods: [{ name: 'সমুচা', kcal: 200, slot: 'snack2' }], exerciseLog: [{ type: 'walk', min: 20 }] })));
    });

    // ধাপ B: ব্যায়াম-টার্গেট (focusAreas → শুধু goal-ডক; ≤৩; অনুমোদিত আইডি)
    it('12g. focusAreas: goal-এ বৈধ তালিকা (খালি-সহ) চলে; ৪টি, অজানা আইডি, ভুল ধরন, daily-তে reject', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goalDoc({ focusAreas: ['belly', 'chest', 'glute'] })));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), { focusAreas: [], lastEditedByMemberId: 'mA' }, { merge: true }));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'f1'), goalDoc({ focusAreas: ['muscle', 'belly', 'chest', 'arms'] })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'f2'), goalDoc({ focusAreas: ['surprise'] })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'f3'), goalDoc({ focusAreas: 'belly' })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'f4'), tr('mA', 'mA', { focusAreas: ['belly'] })));
    });

    it('12f. planPrefs daily-তে, extraFoods/exerciseLog goal-এ, অজানা planPrefs-key, ভুল ধরন ও বড় আকার reject', async () => {
      const db = dbAs('uidA');
      const big = Array.from({ length: 21 }, () => ({ name: 'a', kcal: 1, slot: 'lunch' }));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y1'), tr('mA', 'mA', { planPrefs: prefs })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y2'), goalDoc({ extraFoods: [] })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y3'), goalDoc({ exerciseLog: [] })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y4'), goalDoc({ planPrefs: { v: 1, surprise: {} } })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y5'), goalDoc({ planPrefs: 'x' })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y6'), goalDoc({ planPrefs: { v: 1, meal: [] } })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y7'), tr('mA', 'mA', { extraFoods: big })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y8'), tr('mA', 'mA', { extraFoods: 'x' })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'y9'), tr('mA', 'mA', { exerciseLog: big })));
    });

    it('12f2. planPrefs.foods (খাবার-ওভাররাইড): ≤৪০ map চলে; ৪১টি বা map নয় reject', async () => {
      const db = dbAs('uidA');
      const mk = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['f' + i, { k: 100, note: 'x' }]));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goalDoc({ planPrefs: { ...prefs, foods: mk(40) } })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'z1'), goalDoc({ planPrefs: { ...prefs, foods: mk(41) } })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'z2'), goalDoc({ planPrefs: { ...prefs, foods: [] } })));
    });

    it('12g. অন্য সদস্য (grant ছাড়া) planPrefs/extraFoods লিখতে পারে না; update-পথেও একই নিয়ম', async () => {
      await seed(async (db) => { await setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goalDoc()); });
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'healthTracker', 'goal_mA'), { planPrefs: prefs, lastEditedByMemberId: 'mB' }, { merge: true }));
      await assertFails(updateDoc(famDoc(dbAs('uidA'), 'healthTracker', 'goal_mA'), { extraFoods: [], lastEditedByMemberId: 'mA' }));
      await assertSucceeds(updateDoc(famDoc(dbAs('uidA'), 'healthTracker', 'goal_mA'), { planPrefs: prefs, lastEditedByMemberId: 'mA' }));
    });
  });

  // ============================================================
  // পার্ট ১০: goal-এর নতুন ঐচ্ছিক ফিল্ড fastDays / waterTarget
  describe('12h. Tracker goal: fastDays ও waterTarget', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
    });
    const goal = (extra = {}) => ({
      type: 'goal', memberId: 'mA', sources: {}, lastEditedByMemberId: 'mA', createdAt: OLD, updatedAt: OLD, ...extra,
    });

    it('12h-1. owner বৈধ fastDays/waterTarget লিখতে পারেন (তৈরি, merge, খালি/null সহ)', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goal({ fastDays: [0, 3], waterTarget: 12 })));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), { fastDays: [6], waterTarget: 1, lastEditedByMemberId: 'mA' }, { merge: true }));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), { fastDays: [], waterTarget: null, lastEditedByMemberId: 'mA' }, { merge: true }));
      await assertSucceeds(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), { waterTarget: 20, lastEditedByMemberId: 'mA' }, { merge: true }));
    });

    it('12h-2. অবৈধ ধরন/সীমা/অতিরিক্ত ফিল্ড reject; daily-ডকে এই ফিল্ড চলে না', async () => {
      const db = dbAs('uidA');
      const f = (id, d) => assertFails(setDoc(famDoc(db, 'healthTracker', id), d));
      await f('z1', goal({ fastDays: [0, 1, 2] }));          // ২টির বেশি
      await f('z2', goal({ fastDays: [7] }));                // সীমার বাইরে
      await f('z3', goal({ fastDays: [-1] }));
      await f('z4', goal({ fastDays: [1, 1] }));             // ডুপ্লিকেট
      await f('z5', goal({ fastDays: ['1'] }));              // ভুল ধরন
      await f('z6', goal({ fastDays: 'sat' }));
      await f('z7', goal({ waterTarget: 0 }));
      await f('z8', goal({ waterTarget: 21 }));
      await f('z9', goal({ waterTarget: 8.5 }));
      await f('z10', goal({ waterTarget: '8' }));
      await f('z11', { ...goal({ fastDays: [1] }), type: 'daily', date: '2026-11-08' });
      await f('z12', { ...goal({ waterTarget: 8 }), type: 'daily', date: '2026-11-08' });
    });

    it('12h-3. অন্যের ডকে (grant ছাড়া) লেখা যায় না; update-পথেও একই নিয়ম', async () => {
      await seed(async (db) => { await setDoc(famDoc(db, 'healthTracker', 'goal_mA'), goal()); });
      await assertFails(setDoc(famDoc(dbAs('uidB'), 'healthTracker', 'goal_mA'), { fastDays: [1], lastEditedByMemberId: 'mB' }, { merge: true }));
      await assertFails(updateDoc(famDoc(dbAs('uidB'), 'healthTracker', 'goal_mA'), { waterTarget: 10, lastEditedByMemberId: 'mB' }));
      await assertFails(updateDoc(famDoc(dbAs('uidA'), 'healthTracker', 'goal_mA'), { fastDays: [9], lastEditedByMemberId: 'mA' }));
      await assertSucceeds(updateDoc(famDoc(dbAs('uidA'), 'healthTracker', 'goal_mA'), { fastDays: [2, 5], waterTarget: 9, lastEditedByMemberId: 'mA' }));
    });
  });

  // ধাপ ২: daily-ডকের ঐচ্ছিক `medTaken` ("ওষুধ খেয়েছি" লগ)
  describe('12i. Tracker daily: medTaken (ওষুধ খেয়েছি)', () => {
    beforeEach(async () => {
      await seedOwned('mA', 'uidA');
      await seedOwned('mB', 'uidB');
    });
    const dly = (extra = {}) => ({
      type: 'daily', memberId: 'mA', date: '2026-11-08', caloriesIn: 0, sources: {},
      lastEditedByMemberId: 'mA', createdAt: OLD, updatedAt: OLD, ...extra,
    });
    const ref = (db) => famDoc(db, 'healthTracker', 'daily_mA_2026-11-08');

    it('12i-1. owner নতুন daily ডক medTaken-সহ তৈরি ও একটা key সেট/মোছা (dotted update) করতে পারেন', async () => {
      const db = dbAs('uidA');
      await assertSucceeds(setDoc(ref(db), dly({ medTaken: { Rec1_0800: true } })));
      await assertSucceeds(updateDoc(ref(db), { 'medTaken.Rec2_1400': true, lastEditedByMemberId: 'mA' }));
      await assertSucceeds(updateDoc(ref(db), { 'medTaken.Rec1_0800': deleteField(), lastEditedByMemberId: 'mA' }));
    });

    it('12i-2. medTaken map না হলে, ৬০-এর বেশি key হলে, বা goal-ডকে হলে reject', async () => {
      const db = dbAs('uidA');
      await assertFails(setDoc(ref(db), dly({ medTaken: 'yes' })));
      const big = {};
      for (let i = 0; i < 61; i++) big['R' + i + '_0800'] = true;
      await assertFails(setDoc(ref(db), dly({ medTaken: big })));
      await assertFails(setDoc(famDoc(db, 'healthTracker', 'goal_mA'), dly({ type: 'goal', medTaken: { Rec1_0800: true } })));
      const ok = {};
      for (let i = 0; i < 60; i++) ok['R' + i + '_0800'] = true;
      await assertSucceeds(setDoc(ref(db), dly({ medTaken: ok })));
    });

    it('12i-3. grant ছাড়া অন্য সদস্য লিখতে পারেন না; approved read+write grant থাকলে পারেন', async () => {
      await seed(async (db) => { await setDoc(ref(db), dly()); });
      await assertFails(updateDoc(ref(dbAs('uidB')), { 'medTaken.Rec1_0800': true, lastEditedByMemberId: 'mB' }));
      await seedGrant('mA', 'mB');
      await assertSucceeds(updateDoc(ref(dbAs('uidB')), { 'medTaken.Rec1_0800': true, lastEditedByMemberId: 'mB' }));
    });
  });

  // ============================================================
  describe('13. appDesign (পেজ-কার্ড ডিজাইন — শুধু App Creator লেখে)', () => {
    const CREATOR = 'bZrGqbY0dFVTkIXKvEAwfHbMhRk1';
    const ref = (db, id = 'layout') => doc(db, 'appDesign', id);
    const card = (id) => ({ id, visible: true, fold: 'fixed' });
    const good = { pages: { home: { main: [card('hero'), card('week')] }, trend: { top: [card('heatmap')], week: [card('weight')] } }, updatedAt: new Date(), updatedBy: CREATOR };

    it('13a. সাইন-ইন করা যে কেউ পড়তে পারে; অনাম নয়', async () => {
      await seed(async (db) => { await setDoc(ref(db), good); });
      await assertSucceeds(getDoc(ref(dbAs('uidA'))));
      await assertFails(getDoc(ref(testEnv.unauthenticatedContext().firestore())));
    });
    it('13b. Creator বৈধ ডিজাইন লিখতে পারে (merge-সহ)', async () => {
      const db = dbAs(CREATOR);
      await assertSucceeds(setDoc(ref(db), good));
      await assertSucceeds(setDoc(ref(db), { pages: { home: { main: [card('week')] } }, updatedAt: new Date(), updatedBy: CREATOR }, { merge: true }));
    });
    it('13c. Family Admin বা অন্য সদস্য লিখতে পারে না', async () => {
      await assertFails(setDoc(ref(dbAs(ADMIN_UID)), good));
      await assertFails(setDoc(ref(dbAs('uidA')), good));
    });
    it('13d. অচেনা doc-id / অতিরিক্ত ফিল্ড / অচেনা পেজ / ২০+ কার্ড / মোছা — সব বন্ধ', async () => {
      const db = dbAs(CREATOR);
      await assertFails(setDoc(ref(db, 'other'), good));
      await assertFails(setDoc(ref(db), { ...good, extra: 1 }));
      await assertFails(setDoc(ref(db), { pages: { blog: { main: [] } }, updatedAt: new Date(), updatedBy: CREATOR }));
      await assertFails(setDoc(ref(db), { pages: { home: { main: Array.from({ length: 21 }, (_, i) => card('c' + i)) } }, updatedAt: new Date(), updatedBy: CREATOR }));
      await assertFails(setDoc(ref(db), { pages: { home: { main: [], zzz: [] } }, updatedAt: new Date(), updatedBy: CREATOR }));
      await seed(async (sdb) => { await setDoc(ref(sdb), good); });
      await assertFails(deleteDoc(ref(db)));
    });
  });

  describe('11. Global reference DB', () => {
    it('11. medicineDatabase: শুধু verified পড়া যায়; client write সবসময় বন্ধ', async () => {
      await seed(async (db) => {
        await setDoc(doc(db, 'medicineDatabase', 'good'), { genericName: 'A', status: 'verified' });
        await setDoc(doc(db, 'medicineDatabase', 'draft'), { genericName: 'B', status: 'draft' });
      });
      const db = dbAs('uidA');
      await assertSucceeds(getDoc(doc(db, 'medicineDatabase', 'good')));
      await assertFails(getDoc(doc(db, 'medicineDatabase', 'draft')));
      await assertFails(setDoc(doc(db, 'medicineDatabase', 'x'), { genericName: 'X', status: 'verified' }));
      await assertFails(
        setDoc(doc(dbAs(ADMIN_UID), 'medicineDatabase', 'y'), { genericName: 'Y', status: 'verified' })
      );
    });

    it('11a. dietGuidanceRules: draft-ও লগইন-করা সবাই পড়ে (শুধু সতর্কবার্তা); write সবসময় বন্ধ', async () => {
      await seed(async (db) => {
        await setDoc(doc(db, 'dietGuidanceRules', 'd1'), { linkedTag: { type: 'condition', value: 'x' }, status: 'draft' });
      });
      await assertSucceeds(getDoc(doc(dbAs('uidA'), 'dietGuidanceRules', 'd1')));
      await assertSucceeds(getDocs(collection(dbAs('uidA'), 'dietGuidanceRules')));
      await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'dietGuidanceRules', 'd1')));
      await assertFails(setDoc(doc(dbAs('uidA'), 'dietGuidanceRules', 'z'), { status: 'verified' }));
      await assertFails(setDoc(doc(dbAs(ADMIN_UID), 'dietGuidanceRules', 'z'), { status: 'verified' }));
    });

    it('11b. conditionGuides: লগইন-করা সবাই পড়ে; লেখা/মোছা শুধু অ্যাপ-ক্রিয়েটর', async () => {
      const CREATOR = 'bZrGqbY0dFVTkIXKvEAwfHbMhRk1';
      const good = { what: 'পরিচয়', causes: ['ক'], habits: ['খ'], food: ['গ'], caution: ['ঘ'], status: 'draft' };
      await assertSucceeds(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'ibs'), good));
      await assertSucceeds(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'ibs'), { ...good, status: 'verified', verifiedAt: new Date() }));
      await assertSucceeds(getDoc(doc(dbAs('uidA'), 'conditionGuides', 'ibs')));
      await assertSucceeds(getDocs(collection(dbAs('uidA'), 'conditionGuides')));
      await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'conditionGuides', 'ibs')));
      await assertFails(setDoc(doc(dbAs('uidA'), 'conditionGuides', 'ibs'), good));
      await assertFails(setDoc(doc(dbAs(ADMIN_UID), 'conditionGuides', 'ibs'), good));
      await assertFails(deleteDoc(doc(dbAs(ADMIN_UID), 'conditionGuides', 'ibs')));
      // আকার/ধরন-সীমা ও অচেনা ফিল্ড
      await assertFails(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'x'), { ...good, status: 'weird' }));
      await assertFails(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'x'), { ...good, extra: 1 }));
      await assertFails(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'x'), { ...good, causes: 'not-a-list' }));
      await assertFails(setDoc(doc(dbAs(CREATOR), 'conditionGuides', 'x'), { ...good, what: 'ক'.repeat(1501) }));
      await assertSucceeds(deleteDoc(doc(dbAs(CREATOR), 'conditionGuides', 'ibs')));
    });
  });
});
