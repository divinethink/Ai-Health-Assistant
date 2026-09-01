// Firebase Setup — DailyTask pattern verbatim reuse
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
firebase.initializeApp(firebaseConfig);

// --- Firebase App Check (reCAPTCHA v3) ---
// সম্পূর্ণ ব্যাকগ্রাউন্ডে চলে — কোনো visible puzzle/UI না। Free tier,
// abuse-protection বাড়ায় বলে Walking Skeleton থেকেই রাখা হয়েছে
// (Ground Rule ২ — free plan মানে safety standard শিথিল না)।
// Firebase Console → App Check → Apps → এই web app → reCAPTCHA v3 site key
// রেজিস্টার করতে হবে, এবং Firestore-এর জন্য App Check enforce করতে হবে।
firebase.appCheck().activate(
  new firebase.appCheck.ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
  true // isTokenAutoRefreshEnabled
);

const db = firebase.firestore();
db.enablePersistence().catch(() => {});
const auth = firebase.auth();

export { db, auth };
