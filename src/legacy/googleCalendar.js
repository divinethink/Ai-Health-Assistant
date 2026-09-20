// Google Calendar auto-sync (data/service layer) — owner-approved (২০২৬-০৯-২০)।
// googleDrive.js-এর প্রমাণিত Google Identity Services token-flow pattern reuse
// (একই OAuth Client ID, শুধু আলাদা scope: calendar.events) — কোনো backend/Cloud
// Function/নতুন খরচ নেই। **Owner-side setup (একবার):** Google Cloud Console →
// APIs & Services → "Google Calendar API" Enable + OAuth consent screen-এ scope
// `.../auth/calendar.events` যোগ + (Testing মোডে থাকলে) পরিবারের প্রতিটা সদস্যের
// Gmail "Test users"-এ যোগ।
//
// সীমা (UI-তেও বলা আছে): (ক) sync একমুখী — Google Calendar-এ হাতে বদলালে app জানে না;
// (খ) access token ~১ ঘণ্টা টেকে, তাই প্রতি সেশনে একবার সম্মতি লাগতে পারে;
// (গ) event ব্যবহারকারীর নিজের primary calendar-এ যায় — ঔষধের পুরো নাম সহ
// (owner-সিদ্ধান্ত), calendar কারও সাথে শেয়ার করা থাকলে তারাও দেখবে।

import { GOOGLE_DRIVE_CLIENT_ID } from "./googleDrive.js";

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CAL_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const EVENT_MINUTES = 15;

let calTokenClient = null;
let calAccessToken = null;
let calTokenExpiresAt = 0;
let calTokenInFlight = null;

export function isGoogleCalendarConfigured() {
  return typeof google !== "undefined" && !!(google.accounts && google.accounts.oauth2) && !GOOGLE_DRIVE_CLIENT_ID.startsWith("REPLACE_WITH_");
}

function ensureClient() {
  if (calTokenClient) return calTokenClient;
  calTokenClient = google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_DRIVE_CLIENT_ID, scope: CAL_SCOPE, callback: () => {} });
  return calTokenClient;
}

function requestToken(promptMode) {
  return new Promise((resolve, reject) => {
    const client = ensureClient();
    client.callback = (resp) => {
      if (resp && resp.access_token) {
        calAccessToken = resp.access_token;
        calTokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500 * 1000);
        resolve(calAccessToken);
      } else {
        reject(new Error((resp && resp.error) || "calendar-auth-failed"));
      }
    };
    client.error_callback = (err) => reject(err instanceof Error ? err : new Error((err && err.type) || "calendar-auth-error"));
    try { client.requestAccessToken({ prompt: promptMode }); } catch (err) { reject(err); }
  });
}

// user-gesture (বাটন-ক্লিক)-এর মধ্যেই, অন্য কোনো await-এর আগে কল করুন (popup-blocker এড়াতে)।
export async function authorizeGoogleCalendar() {
  if (!isGoogleCalendarConfigured()) throw new Error("Google Calendar সেটআপ করা হয়নি (Google সাইন-ইন স্ক্রিপ্ট লোড হয়নি বা Client ID নেই)।");
  if (calAccessToken && Date.now() < calTokenExpiresAt - 60000) return calAccessToken;
  if (calTokenInFlight) return calTokenInFlight;
  calTokenInFlight = (async () => {
    try { return await requestToken(""); } catch (err) { return await requestToken("consent"); }
  })();
  try { return await calTokenInFlight; } finally { calTokenInFlight = null; }
}

async function calFetch(url, options, retried) {
  const token = await authorizeGoogleCalendar();
  const res = await fetch(url, {
    ...(options || {}),
    headers: { "Content-Type": "application/json", ...((options && options.headers) || {}), Authorization: "Bearer " + token },
  });
  if (res.status === 401 && !retried) { calAccessToken = null; return calFetch(url, options, true); }
  return res;
}

async function insertEvent(body) {
  const res = await calFetch(CAL_API, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Calendar API error " + res.status + ": " + text.slice(0, 200));
  }
  return (await res.json()).id;
}

// লোকাল-সময় ISO (Z ছাড়া) — timeZone আলাদা field-এ যায়।
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtLocal(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":00";
}
function localDateStr(d) { return fmtLocal(d).slice(0, 10); }
function untilUtc(endDate) {
  const d = new Date(endDate + "T23:59:59");
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ঔষধ: প্রতি বেলার জন্য একটা daily recurring event (endDate-এ শেষ), popup reminder ঠিক সময়ে।
// endDate বাধ্যতামূলক (অসীম daily event তৈরি এড়াতে)। ফেরত: তৈরি event-ID-র array।
export async function createMedicationCalendarEvents({ memberName, genericName, mealTimingLabel, times, startDate, endDate }) {
  if (!endDate) throw new Error("Calendar-এ যোগ করতে \"কত তারিখ পর্যন্ত খাবেন\" দিন।");
  if (!times || times.length === 0) throw new Error("অন্তত একটা বেলার সময় দিন।");
  const now = new Date();
  const today = localDateStr(now);
  const startDay = startDate && startDate > today ? startDate : today;
  if (endDate < startDay) throw new Error("শেষ তারিখ আজকের আগে — Calendar-এ যোগ করা যাবে না।");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const summary = "💊 " + (memberName ? memberName + " — " : "") + genericName + (mealTimingLabel ? " (" + mealTimingLabel + ")" : "");
  const ids = [];
  try {
    for (const hhmm of times) {
      const start = new Date(startDay + "T" + hhmm + ":00");
      const end = new Date(start.getTime() + EVENT_MINUTES * 60000);
      ids.push(await insertEvent({
        summary,
        description: "Health Assistant অ্যাপ থেকে যোগ হয়েছে — ওষুধ সেবনের রিমাইন্ডার।",
        start: { dateTime: fmtLocal(start), timeZone: tz },
        end: { dateTime: fmtLocal(end), timeZone: tz },
        recurrence: ["RRULE:FREQ=DAILY;UNTIL=" + untilUtc(endDate)],
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
      }));
    }
  } catch (err) {
    // আংশিক তৈরি হয়ে গেলে ফেলে-রাখা event এড়াতে rollback (best-effort)
    await deleteCalendarEventsByIds(ids).catch(() => {});
    throw err;
  }
  return ids;
}

// অ্যাপয়েন্টমেন্ট/টিকা/চেকআপ: all-day event, আগের দিন সকাল ৯টায় popup reminder।
export async function createAllDayCalendarEvent({ title, date, description }) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + 1);
  return insertEvent({
    summary: title,
    description: description || "Health Assistant অ্যাপ থেকে যোগ হয়েছে",
    start: { date },
    end: { date: localDateStr(next) },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 900 }] },
  });
}

// 404/410 (ইতিমধ্যে মোছা) সফল ধরা হয়। ফেরত: সফলভাবে সরানো সংখ্যা।
export async function deleteCalendarEventsByIds(ids) {
  let removed = 0;
  for (const id of ids || []) {
    const res = await calFetch(CAL_API + "/" + encodeURIComponent(id), { method: "DELETE" });
    if (res.ok || res.status === 404 || res.status === 410) removed++;
    else throw new Error("Calendar API error " + res.status);
  }
  return removed;
}
