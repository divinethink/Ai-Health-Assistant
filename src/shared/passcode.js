// অ্যাপ-লক PIN — pure crypto helper (UI/Storage-মুক্ত, test-যোগ্য)। PIN কখনো plain সংরক্ষণ হয় না: salt + PBKDF2-SHA256 hash।
// এটা "স্ক্রিন-লক" (অন্যের হাতে ফোন গেলে) — স্বাস্থ্য-ডেটার encryption নয়।
export const PIN_LENGTH = 4;
export const PBKDF2_ITERATIONS = 150000;

export const isValidPin = (pin) => typeof pin === "string" && new RegExp("^\\d{" + PIN_LENGTH + "}$").test(pin);

const toB64 = (u) => btoa(String.fromCharCode(...u));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newSaltB64() {
  return toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin, saltB64, iterations = PBKDF2_ITERATIONS) {
  const key = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, key, 256);
  return toB64(new Uint8Array(bits));
}

// সময়-নির্ভর নয় এমন তুলনা
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ভুল-চেষ্টার throttle (pure): ৫ বার ভুলের পর ৩০ সেকেন্ড, তারপর প্রতি ৫ ভুলে দ্বিগুণ — সর্বোচ্চ ১৫ মিনিট
export const FREE_TRIES = 5;
export const BASE_LOCKOUT_MS = 30000;
export const MAX_LOCKOUT_MS = 15 * 60000;
export function lockoutUntil(count, now) {
  const over = count - FREE_TRIES;
  return over >= 0 ? now + Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** Math.floor(over / FREE_TRIES)) : 0;
}
