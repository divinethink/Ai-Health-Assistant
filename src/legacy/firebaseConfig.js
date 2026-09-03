// Firebase Setup — DailyTask pattern reuse + defensive error-capture
// (Walking Skeleton debugging aid — non-coder owner-এর জন্য, যাতে blank
// white-page-এর বদলে আসল error টেক্সট স্ক্রিনে দেখা যায়)
//
// FIX (এই থ্রেড): db.enablePersistence() সরানো হয়েছে — single-tab
// offline-persistence একাধিক ব্রাউজার-ট্যাবে conflict করে "INTERNAL
// ASSERTION FAILED" ও persistence-layer error তৈরি করছিল। Roadmap/
// Architecture Plan-এ offline-persistence কোনো Confirmed requirement না,
// তাই সম্পূর্ণ বাদ দেওয়া হলো (workaround না, root-cause fix)।

let initError = null;
let db = null;
let auth = null;

try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      "Firebase env-vars missing/empty — Cloudflare Pages → Settings → " +
      "Environment variables চেক করুন, এবং যোগ করার পর redeploy করেছেন কিনা নিশ্চিত করুন।"
    );
  }

  firebase.initializeApp(firebaseConfig);

  try {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      firebase.appCheck().activate(
        new firebase.appCheck.ReCaptchaV3Provider(siteKey),
        true
      );
    }
  } catch (appCheckErr) {
    // App Check ব্যর্থ হলেও পুরো app crash করা উচিত না — শুধু console-এ নোট রাখা
    console.error("App Check init failed (non-fatal):", appCheckErr);
  }

  db = firebase.firestore();
  auth = firebase.auth();
} catch (err) {
  initError = (err && err.message) ? err.message : String(err);
  console.error("Firebase init failed:", err);
}

export { db, auth, initError };
