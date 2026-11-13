// অ্যাপ-লক স্টোর — শুধু এই ডিভাইসে (localStorage): PIN-এর salt+hash, ভুল-চেষ্টার গণনা, ফিঙ্গারপ্রিন্ট credential-id।
// PIN/বায়োমেট্রিক Firestore-এ বা কোনো সার্ভারে যায় না; স্বাস্থ্য-ডেটা এখানে নেই (শুধু একমুখী hash)।
// ফিঙ্গারপ্রিন্ট = ফোনের WebAuthn platform authenticator: অ্যাপ বায়োমেট্রিক ডেটা দেখে না, ফোন "যাচাই হয়েছে" বললেই আনলক। PIN সবসময় বিকল্প।
import { hashPin, isValidPin, newSaltB64, PBKDF2_ITERATIONS, safeEqual, lockoutUntil } from "./passcode.js";

const KEY = "hs.applock.v1";
const FAIL_KEY = "hs.applock.fail.v1";
const BIO_KEY = "hs.biometric.v1";

function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.v === 1 && typeof o.salt === "string" && typeof o.hash === "string" && typeof o.iter === "number" ? o : null;
  } catch (_e) { return null; }
}
function readFail() {
  try {
    const o = JSON.parse(localStorage.getItem(FAIL_KEY) || "{}");
    return { count: Number(o.count) || 0, until: Number(o.until) || 0 };
  } catch (_e) { return { count: 0, until: 0 }; }
}
function writeFail(f) {
  try {
    if (f.count === 0) localStorage.removeItem(FAIL_KEY); else localStorage.setItem(FAIL_KEY, JSON.stringify(f));
  } catch (_e) { /* উপেক্ষা */ }
}

export const hasPasscode = () => readStored() !== null;

// ---- lock অবস্থা (in-memory, subscribe-যোগ্য) ----
let locked = hasPasscode(); // কোল্ড-স্টার্টে PIN থাকলে লক
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
export function subscribeLock(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const isLocked = () => locked && hasPasscode();
export const useAppLocked = () => React.useSyncExternalStore(subscribeLock, isLocked);
export const useHasPasscode = () => React.useSyncExternalStore(subscribeLock, hasPasscode);

export function lockNow() { if (hasPasscode()) { locked = true; emit(); } }

export async function setPasscode(pin) {
  if (!isValidPin(pin)) throw new Error("Invalid passcode");
  const salt = newSaltB64();
  const hash = await hashPin(pin, salt, PBKDF2_ITERATIONS);
  localStorage.setItem(KEY, JSON.stringify({ v: 1, salt, hash, iter: PBKDF2_ITERATIONS })); // ব্যর্থ হলে throw — UI জানাবে
  writeFail({ count: 0, until: 0 });
  locked = false;
  emit();
}

export function clearPasscode() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(FAIL_KEY); } catch (_e) { /* উপেক্ষা */ }
  disableBiometric(); // PIN ছাড়া বায়োমেট্রিক-আনলক থাকে না
  locked = false;
  emit();
}

export const lockoutRemainingMs = (now = Date.now()) => Math.max(0, readFail().until - now);

// PIN যাচাই + throttle; লক খোলে না। ফল: "ok" | "wrong" | "locked"
export async function tryPasscode(pin, now = Date.now()) {
  const stored = readStored();
  if (!stored) return "ok";
  if (lockoutRemainingMs(now) > 0) return "locked";
  const hash = await hashPin(pin, stored.salt, stored.iter);
  if (safeEqual(hash, stored.hash)) { writeFail({ count: 0, until: 0 }); return "ok"; }
  const count = readFail().count + 1;
  writeFail({ count, until: lockoutUntil(count, now) });
  return "wrong";
}

// লক-স্ক্রিন থেকে: ঠিক PIN হলে লক খোলে
export async function unlock(pin) {
  const r = await tryPasscode(pin);
  if (r === "ok") { locked = false; emit(); }
  return r;
}

// ---- ফিঙ্গারপ্রিন্ট / ফেস (WebAuthn, শুধু লোকাল) ----
const toB64 = (u) => btoa(String.fromCharCode(...u));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function biometricSupported() {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (_e) { return false; }
}
function bioId() { try { return localStorage.getItem(BIO_KEY); } catch (_e) { return null; } }
export const hasBiometric = () => bioId() !== null;

export async function enableBiometric() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: "স্বাস্থ্য সহকারী", id: location.hostname },
        user: { id: rand(16), name: "owner", displayName: "Owner" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000, attestation: "none",
      },
    });
    if (!cred) return false;
    localStorage.setItem(BIO_KEY, toB64(new Uint8Array(cred.rawId)));
    return true;
  } catch (_e) { return false; }
}

export async function verifyBiometric() {
  const id = bioId();
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: { challenge: rand(32), allowCredentials: [{ type: "public-key", id: fromB64(id), transports: ["internal"] }], userVerification: "required", rpId: location.hostname, timeout: 60000 },
    });
    return res !== null;
  } catch (_e) { return false; }
}

export function disableBiometric() { try { localStorage.removeItem(BIO_KEY); } catch (_e) { /* উপেক্ষা */ } }

// লক-স্ক্রিন থেকে: ফিঙ্গারপ্রিন্ট সেট থাকলে ফোনের যাচাই; সফল হলে লক খোলে (ব্যর্থ হলে PIN)
export async function unlockWithBiometric() {
  if (!hasPasscode() || !hasBiometric()) return false;
  const ok = await verifyBiometric();
  if (ok) { locked = false; emit(); }
  return ok;
}

// অ্যাপ ব্যাকগ্রাউন্ডে graceMs বা বেশি থাকলে ফিরে এসে লক (কম হলে — কল/নোটিফিকেশন দেখে ফেরা — লক নয়)
export function useAutoLock(graceMs = 30000) {
  React.useEffect(() => {
    let hiddenAt = null;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else { if (hiddenAt !== null && Date.now() - hiddenAt >= graceMs) lockNow(); hiddenAt = null; }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [graceMs]);
}
