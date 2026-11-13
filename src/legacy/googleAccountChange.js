// googleAccountChange.js — "জিমেইল বদলান"-এর pure অংশ (Firebase/UI ছাড়া, Node-এ টেস্টযোগ্য)।
// DailyTask-এর প্রমাণিত pattern থেকে। নীতি: UID অপরিবর্তিত রেখে শুধু Google প্রোভাইডার বদলানো (unlink → link),
// তাই rules/schema/ডেটায় বদল লাগে না (users/{uid}, uidMemberIndex, adminUids সব একই থাকে)।
// ঝুঁকির জানালা: unlink-এর পর link শেষ না হওয়া পর্যন্ত অ্যাকাউন্ট Google-ছাড়া — তখন রিকভারি-গেট দেখানো হয়।

const RELINK_FLAG = "ha_google_relink_pending"; // মান = পুরনো জিমেইল (normalized) বা "1"

const MESSAGES = {
  alreadyUsed: "এই জিমেইল অ্যাকাউন্ট ইতিমধ্যে অন্য পরিচয়ে ব্যবহৃত হচ্ছে। অন্য একটি অ্যাকাউন্ট বেছে নিন, অথবা পুরনো জিমেইল ফিরিয়ে আনুন।",
  incomplete: "অ্যাকাউন্ট বেছে নেওয়া সম্পূর্ণ হয়নি। আবার চেষ্টা করুন।",
  popupBlocked: "পপআপ বন্ধ ছিল। ব্রাউজারে পপআপের অনুমতি দিয়ে আবার চেষ্টা করুন।",
  network: "ইন্টারনেট সংযোগে সমস্যা হয়েছে। সংযোগ ঠিক করে আবার চেষ্টা করুন।",
  recentLogin: "নিরাপত্তার জন্য আগে লগআউট করে আবার সাইন-ইন করুন, তারপর চেষ্টা করুন।",
  generic: "যুক্ত করা যায়নি। আবার চেষ্টা করুন।",
};

// Firebase error code ⇒ ব্যবহারকারীর বার্তা (internal কোড কখনো সরাসরি দেখানো হয় না)।
function relinkErrorMessage(code) {
  switch (code) {
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
      return MESSAGES.alreadyUsed;
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return MESSAGES.incomplete;
    case "auth/popup-blocked":
      return MESSAGES.popupBlocked;
    case "auth/network-request-failed":
      return MESSAGES.network;
    case "auth/requires-recent-login":
      return MESSAGES.recentLogin;
    default:
      return MESSAGES.generic;
  }
}

// ফ্ল্যাগের মান থেকে পুরনো জিমেইল (শুধু "@" থাকলে), নইলে null।
function oldEmailFromFlag(v) {
  return typeof v === "string" && v.includes("@") ? v : null;
}

// user-এ Google provider আছে কিনা / তার email (compat ও modular দুটোর providerData একই আকার)।
function hasGoogleProvider(user) {
  return !!(user && user.providerData && user.providerData.some((x) => x.providerId === "google.com"));
}
function googleProviderEmail(user) {
  const p = user && user.providerData ? user.providerData.find((x) => x.providerId === "google.com") : null;
  return (p && p.email) || (user && user.email) || null;
}

export { RELINK_FLAG, MESSAGES, relinkErrorMessage, oldEmailFromFlag, hasGoogleProvider, googleProviderEmail };
