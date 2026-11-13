// জিমেইল-বদলের pure অংশ। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { relinkErrorMessage, MESSAGES, oldEmailFromFlag, hasGoogleProvider, googleProviderEmail } from "../../src/legacy/googleAccountChange.js";

test("error code → বার্তা", () => {
  assert.equal(relinkErrorMessage("auth/credential-already-in-use"), MESSAGES.alreadyUsed);
  assert.equal(relinkErrorMessage("auth/popup-closed-by-user"), MESSAGES.incomplete);
  assert.equal(relinkErrorMessage("auth/network-request-failed"), MESSAGES.network);
  assert.equal(relinkErrorMessage("xyz"), MESSAGES.generic);
});
test("ফ্ল্যাগ থেকে পুরনো মেইল", () => {
  assert.equal(oldEmailFromFlag("a@b.com"), "a@b.com");
  assert.equal(oldEmailFromFlag("1"), null);
  assert.equal(oldEmailFromFlag(null), null);
});
test("Google provider শনাক্ত", () => {
  const u = { email: "x@y.com", providerData: [{ providerId: "google.com", email: "g@y.com" }] };
  assert.equal(hasGoogleProvider(u), true);
  assert.equal(googleProviderEmail(u), "g@y.com");
  assert.equal(hasGoogleProvider({ providerData: [] }), false);
  assert.equal(hasGoogleProvider(null), false);
});
