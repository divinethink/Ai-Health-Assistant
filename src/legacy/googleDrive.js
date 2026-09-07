// Google Drive Backup (Architecture Plan Part C §8.3, roadmap §13 — "Google Drive
// (drive.appdata scope, hidden app-only folder)")। DailyTask app-এর প্রমাণিত OAuth
// token-client pattern reuse করা হয়েছে (Process Rule ২, Proven Pattern Reuse),
// কিন্তু scope roadmap-এর সিদ্ধান্ত অনুযায়ী **drive.appdata** — DailyTask-এর visible
// drive.file+named-folder থেকে ইচ্ছাকৃতভাবে ভিন্ন (health data sensitivity বিবেচনায়
// hidden app-only space, §13 Confirmed)। এই scope-এ Drive-এর বিশেষ সংরক্ষিত
// `appDataFolder` স্পেস ব্যবহার হয় — তাই DailyTask-এর মতো আলাদা visible folder
// তৈরির ধাপ (findOrCreateDriveBackupFolder) এখানে প্রয়োজন নেই, সরাসরি সরল।
//
// **Owner-side setup প্রয়োজন (deploy-এর আগে, কোড push-এর পর):**
//   ১. Google Cloud Console-এ (এই app-এর Firebase project-এই, বা আলাদা) Drive
//      API enable করুন।
//   ২. OAuth consent screen configure করুন (External, Testing/Production)।
//   ৩. Credentials → Create OAuth Client ID → type "Web application" →
//      Authorized JavaScript origins-এ আপনার Cloudflare Pages deploy-URL যোগ
//      করুন (যেমন https://your-app.pages.dev)।
//   ৪. তৈরি হওয়া Client ID (এটা secret না, public — client bundle-এ থাকা
//      নিরাপদ, GROQ_API_KEY-এর মতো secret না) নিচের GOOGLE_DRIVE_CLIENT_ID-এ বসান।
//   ৫. index.html-এ Google Identity Services script tag (`accounts.google.com/gsi/client`)
//      যোগ করা আছে — আলাদা কিছু করার নেই।

import { buildBackupPayload, buildBackupFileName } from "./backupData.js";

const GOOGLE_DRIVE_CLIENT_ID = "953109057516-gh99c3cbvipt93vvrae8j9adajn04g8m.apps.googleusercontent.com";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

let driveTokenClient = null;
let driveAccessToken = null;
let driveTokenExpiresAt = 0;
// concurrent caller-দের একই in-flight token-request-এ await করানোর জন্য
// (DailyTask H-4 fix pattern — GIS token-client-এর single shared callback
// একাধিক concurrent কল থেকে overwrite হওয়া এড়াতে)।
let driveTokenRequestInFlight = null;

export function isGoogleDriveConfigured() {
  return (
    typeof google !== "undefined" &&
    !!(google.accounts && google.accounts.oauth2) &&
    !GOOGLE_DRIVE_CLIENT_ID.startsWith("REPLACE_WITH_")
  );
}
function ensureDriveTokenClient() {
  if (driveTokenClient) return driveTokenClient;
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_DRIVE_CLIENT_ID,
    scope: GOOGLE_DRIVE_SCOPE,
    callback: () => {},
  });
  return driveTokenClient;
}
// silent (prompt:"") আগে চেষ্টা — আগে থেকে অনুমতি থাকলে popup ছাড়াই কাজ করে;
// ব্যর্থ হলে consent popup। user-gesture (বাটন-ক্লিক)-এর মধ্যেই কল হওয়া আবশ্যক
// (popup-blocker এড়াতে)।
function requestDriveAccessToken(promptMode) {
  return new Promise((resolve, reject) => {
    const client = ensureDriveTokenClient();
    client.callback = (resp) => {
      if (resp && resp.access_token) {
        driveAccessToken = resp.access_token;
        driveTokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500 * 1000);
        resolve(driveAccessToken);
      } else {
        reject(new Error((resp && resp.error) || "drive-auth-failed"));
      }
    };
    client.error_callback = (err) => reject(err instanceof Error ? err : new Error((err && err.type) || "drive-auth-error"));
    try {
      client.requestAccessToken({ prompt: promptMode });
    } catch (err) {
      reject(err);
    }
  });
}
async function getDriveAccessToken(allowConsentPopup = true) {
  if (!isGoogleDriveConfigured()) {
    throw new Error("Google Drive ব্যাকআপ এখনো সেটআপ করা হয়নি (owner-side OAuth Client ID setup বাকি)।");
  }
  if (driveAccessToken && Date.now() < driveTokenExpiresAt - 60000) return driveAccessToken;
  if (driveTokenRequestInFlight) return driveTokenRequestInFlight;
  driveTokenRequestInFlight = (async () => {
    try {
      return await requestDriveAccessToken("");
    } catch (err) {
      if (!allowConsentPopup) throw err;
      return await requestDriveAccessToken("consent");
    }
  })();
  try {
    return await driveTokenRequestInFlight;
  } finally {
    driveTokenRequestInFlight = null;
  }
}
async function driveFetch(url, options, _retriedAfter401) {
  const token = await getDriveAccessToken();
  const res = await fetch(url, {
    ...(options || {}),
    headers: { ...((options && options.headers) || {}), Authorization: `Bearer ${token}` },
  });
  // cached token লোকাল-ক্লকে ঠিক দেখালেও server-side reject হতে পারে (revoke/skew) —
  // একবার 401-এ token clear করে একবারই fresh retry (DailyTask M-3 fix pattern)।
  if (res.status === 401 && !_retriedAfter401) {
    driveAccessToken = null;
    return driveFetch(url, options, true);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

// appDataFolder — flat, hidden space; নাম দিয়ে exact-match খোঁজা হয় (প্রতিটা
// scope+family+member combination-এর deterministic filename, backupData.js
// buildBackupFileName())।
async function findDriveBackupFile(fileName) {
  const q = encodeURIComponent(`name='${fileName}' and trashed=false`);
  const res = await driveFetch(
    `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=appDataFolder&pageSize=5`
  );
  const json = await res.json();
  return (json.files && json.files[0]) || null;
}

async function uploadDriveBackup(payload, fileName, existingFileId) {
  // বিদ্যমান ফাইল আপডেটে metadata (name/parents) আবার পাঠানোর দরকার নেই —
  // শুধু নতুন ফাইল তৈরির সময়ই parents: appDataFolder সেট করতে হয়।
  const metadata = existingFileId ? {} : { name: fileName, parents: ["appDataFolder"] };
  const boundary = "healthapp_" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;
  const url = existingFileId
    ? `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,modifiedTime`;
  const res = await driveFetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

async function downloadDriveBackupContent(fileId) {
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`);
  return res.json();
}

// Backup — buildBackupPayload() (backupData.js, schema/logic অপরিবর্তিত) → Drive।
// "Always Replace" model (§8.3): একই deterministic filename-এ existing থাকলে
// PATCH (overwrite), না থাকলে নতুন তৈরি — একটাই ফাইল সবসময়, dated snapshot না।
export async function backupToGoogleDrive(familyId, scope, callerMemberId) {
  const fileName = buildBackupFileName(scope, familyId, callerMemberId);
  const payload = await buildBackupPayload(familyId, scope, callerMemberId);
  const existing = await findDriveBackupFile(fileName);
  await uploadDriveBackup(payload, fileName, existing ? existing.id : null);
  return { fileName };
}

// Restore path — Drive থেকে raw backup-content download করে ফেরত দেয়; merge/
// plan-logic device-local file-import-এর সাথে সম্পূর্ণ অভিন্ন (backupData.js-এর
// planRestore()/commitRestore()) — এখানে duplicate করা হয়নি, caller
// (BackupRestoreSection.js) একই handleParsedBackup() flow-এ এই object পাঠাবে।
export async function fetchGoogleDriveBackup(familyId, scope, callerMemberId) {
  const fileName = buildBackupFileName(scope, familyId, callerMemberId);
  const existing = await findDriveBackupFile(fileName);
  if (!existing) throw new Error("Google Drive-এ এই ধরনের কোনো ব্যাকআপ ফাইল পাওয়া যায়নি।");
  const content = await downloadDriveBackupContent(existing.id);
  return { fileName, modifiedTime: existing.modifiedTime, content };
}
