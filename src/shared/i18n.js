// ভাষা-নির্বাচন (বাংলা / English) — কেন্দ্রীয় টেক্সট-ফাইল।
// শুধু client-side পছন্দ (localStorage "hs-lang"); Firestore/schema-তে কিছু লেখা হয় না।
// ব্যবহার: t("nav.home"); ভাষা বদলালে app.js Dashboard-কে key দিয়ে নতুন করে render করে।
// নতুন টেক্সট যোগ করতে নিচে bn ও en দুই জায়গাতেই একই key বসান; en না থাকলে bn দেখায়।

const STORAGE_KEY = "hs-lang";
const LANGS = ["bn", "en"];

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v) ? v : "bn";
  } catch (e) { return "bn"; }
}

let current = readStored();
const listeners = new Set();

export function getLang() { return current; }

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* noop */ }
  document.documentElement.setAttribute("lang", lang);
  listeners.forEach((fn) => fn(lang));
}

export function useLang() {
  const [lang, setL] = React.useState(current);
  React.useEffect(() => {
    listeners.add(setL);
    return () => listeners.delete(setL);
  }, []);
  return lang;
}

const DICT = {
  bn: {
    "nav.home": "হোম", "nav.aichat": "এআই চ্যাট", "nav.blog": "ব্লগ", "nav.tracker": "ট্র্যাকার", "nav.docs": "নথিপত্র", "nav.menu": "মেনু",

    "title.home": "🏠 স্বাস্থ্য রেকর্ড", "title.aichat": "🩺 এআই চ্যাট", "title.blog": "🌿 স্বাস্থ্য ব্লগ", "title.tracker": "📈 হেলথ ট্র্যাকার",
    "title.docs": "📁 নথিপত্র", "title.menu": "☰ মেনু",

    "tab.profile": "প্রোফাইল", "tab.records": "স্বাস্থ্য তথ্য", "tab.diet": "খাদ্য নির্দেশিকা",
    "tab.medication": "ওষুধ ও রিমাইন্ডার", "tab.timeline": "টাইমলাইন ও ক্যালেন্ডার",
    "tab.symptom": "🩺 লক্ষণ যাচাই", "tab.medsci": "⚕️ আধুনিক চিকিৎসা", "tab.herbal": "🌿 ভেষজ", "tab.homeo": "💧 হোমিওপ্যাথি",
    "tab.nutrition": "🥗 পুষ্টি", "tab.fitness": "🏃 ব্যায়াম", "tab.upload": "📁 জমা নথি", "tab.export": "🩺 ডাক্তারের জন্য",

    "top.role": "ভূমিকা", "top.familyCode": "পরিবারের কোড", "top.generalChat": "🌐 সাধারণ চ্যাট",
    "top.logout": "🚪 লগ-আউট", "top.member": "সদস্য",

    "menu.prefs": "⚙️ পছন্দ — থিম", "menu.settings": "⚙️ সেটিংস (ভাষা ও থিম)", "menu.back": "← মেনু", "menu.aichatSub": "লক্ষণ যাচাই ও স্বাস্থ্য-পরামর্শ", "menu.familyTitle": "পরিবার", "menu.familySub": "সদস্য ও অ্যাক্সেস", "menu.dataTitle": "ডেটা ব্যাকআপ", "menu.dataSub": "ব্যাকআপ রাখুন ও ফিরিয়ে আনুন", "menu.settingsTitle": "সেটিংস", "menu.settingsSub": "ভাষা ও থিম", "menu.copy": "কপি", "menu.copied": "কপি হয়েছে ✓", "menu.adminTools": "🛠 Admin টুলস (আমন্ত্রণ ও নতুন সদস্য)", "menu.emergencyShort": "📞 জরুরি সেবা", "menu.language": "🌐 ভাষা", "menu.family": "👨‍👩‍👧‍👦 পরিবার",
    "menu.nav": "🧭 নেভিগেশন", "menu.doctor": "🩺 ডাক্তারের তথ্য ও ভিজিটিং কার্ড",
    "menu.care": "📞 জরুরি সেবা — যাচাই করা তালিকা", "menu.data": "💾 ডেটা — ব্যাকআপ/রিস্টোর",
    "theme.light": "☀️ হালকা", "theme.sepia": "📜 সেপিয়া", "theme.dark": "🌙 গাঢ়",
    "lang.bn": "বাংলা", "lang.en": "English",

    "h.records": "স্বাস্থ্য রেকর্ড", "h.timeline": "স্বাস্থ্য টাইমলাইন", "h.calendar": "📅 পরিবারের স্বাস্থ্য ক্যালেন্ডার",
    "h.docs": "নথি / রিপোর্ট", "h.triage": "লক্ষণ যাচাই",

    "f.new": "নতুন স্বাস্থ্য রেকর্ড যোগ করুন", "f.edit": "স্বাস্থ্য রেকর্ড সম্পাদনা করুন",
    "f.type": "ধরন", "f.typeFixed": "(সম্পাদনায় বদলানো যায় না)",
    "type.condition": "অসুস্থতা", "type.observation": "পরিমাপ (সুগার, ওজন ইত্যাদি)",
    "type.medicationStatement": "ওষুধ", "type.allergy": "এলার্জি",
    "f.name": "নাম", "f.category": "বিভাগ", "f.status": "অবস্থা", "f.onset": "শুরুর তারিখ (ঐচ্ছিক)",
    "f.date": "তারিখ (ঐচ্ছিক)", "f.startDate": "শুরুর তারিখ (ঐচ্ছিক)",
    "f.notes": "সংক্ষিপ্ত বিবরণ (ঐচ্ছিক, ১-২ লাইন)", "f.chronic": "এটা কি দীর্ঘমেয়াদি সমস্যা? (যেমন: ডায়াবেটিস, উচ্চ রক্তচাপ, থাইরয়েড, কিডনি রোগ)",
    "f.physician": "চিকিৎসক যোগাযোগ (ঐচ্ছিক)",
    "f.obsType": "কীসের পরিমাপ", "f.value": "মান", "f.unit": "একক",
    "f.medName": "ওষুধের নাম", "f.freq": "কয় বেলা / কীভাবে খাবেন", "f.days": "কতদিন খেতে হবে (দিন)",
    "f.tier": "ওষুধের ধরন", "f.substance": "যে জিনিসে এলার্জি", "f.reaction": "কী সমস্যা হয়", "f.severity": "কতটা গুরুতর",
    "st.active": "চলছে", "st.resolved": "সেরে গেছে", "st.chronic": "দীর্ঘমেয়াদি", "st.stopped": "বন্ধ",
    "tier.otc-self-care": "সাধারণ (নিজে খাওয়া যায়)", "tier.requires-consult": "ডাক্তারের পরামর্শ লাগবে",
    "sev.mild": "হালকা", "sev.moderate": "মাঝারি", "sev.severe": "গুরুতর",
    "btn.save": "সংরক্ষণ করুন", "btn.update": "হালনাগাদ করুন", "btn.cancel": "বাতিল",
    "err.condition": "অসুস্থতার নাম লিখুন।", "err.observation": "কীসের পরিমাপ ও মান লিখুন।",
    "err.medicine": "ওষুধের নাম লিখুন।", "err.allergy": "কীসে এলার্জি তা লিখুন।",
    "err.denied": "এই সদস্যের স্বাস্থ্য রেকর্ডে পরিবর্তন করার অনুমতি আপনার নেই।",
  },
  en: {
    "nav.home": "Home", "nav.aichat": "AI Chat", "nav.blog": "Blog", "nav.tracker": "Tracker", "nav.docs": "Documents", "nav.menu": "Menu",

    "title.home": "🏠 Health Records", "title.aichat": "🩺 AI Chat", "title.blog": "🌿 Health Blog", "title.tracker": "📈 Health Tracker",
    "title.docs": "📁 Documents", "title.menu": "☰ Menu",

    "tab.profile": "Profile", "tab.records": "Health Info", "tab.diet": "Diet Guide",
    "tab.medication": "Medicines & Reminders", "tab.timeline": "Timeline & Calendar",
    "tab.symptom": "🩺 Symptom Check", "tab.medsci": "⚕️ Medical Science", "tab.herbal": "🌿 Herbal", "tab.homeo": "💧 Homeopathy",
    "tab.nutrition": "🥗 Nutrition", "tab.fitness": "🏃 Fitness", "tab.upload": "📁 My Documents", "tab.export": "🩺 For Doctor",

    "top.role": "Role", "top.familyCode": "Family code", "top.generalChat": "🌐 General Chat",
    "top.logout": "🚪 Log out", "top.member": "Member",

    "menu.prefs": "⚙️ Preferences — Theme", "menu.settings": "⚙️ Settings (Language & Theme)", "menu.back": "← Menu", "menu.aichatSub": "Symptom check & health guidance", "menu.familyTitle": "Family", "menu.familySub": "Members & access", "menu.dataTitle": "Data Backup", "menu.dataSub": "Back up and restore", "menu.settingsTitle": "Settings", "menu.settingsSub": "Language & theme", "menu.copy": "Copy", "menu.copied": "Copied ✓", "menu.adminTools": "🛠 Admin Tools (Invite & New Member)", "menu.emergencyShort": "📞 Emergency", "menu.language": "🌐 Language", "menu.family": "👨‍👩‍👧‍👦 Family",
    "menu.nav": "🧭 Navigation", "menu.doctor": "🩺 Doctor Details & Visiting Cards",
    "menu.care": "📞 Emergency Care — Verified Directory", "menu.data": "💾 Data — Backup/Restore",
    "theme.light": "☀️ Light", "theme.sepia": "📜 Sepia", "theme.dark": "🌙 Dark",
    "lang.bn": "বাংলা", "lang.en": "English",

    "h.records": "Health Records", "h.timeline": "Health Timeline", "h.calendar": "📅 Family Health Calendar",
    "h.docs": "Documents / Reports", "h.triage": "Symptom Check",

    "f.new": "Add a new health record", "f.edit": "Edit health record",
    "f.type": "Type", "f.typeFixed": "(cannot be changed while editing)",
    "type.condition": "Condition", "type.observation": "Measurement (sugar, weight, etc.)",
    "type.medicationStatement": "Medicine", "type.allergy": "Allergy",
    "f.name": "Name", "f.category": "Category", "f.status": "Status", "f.onset": "Start date (optional)",
    "f.date": "Date (optional)", "f.startDate": "Start date (optional)",
    "f.notes": "Short note (optional, 1–2 lines)", "f.chronic": "Is this a long-term problem? (e.g. diabetes, high blood pressure, thyroid, kidney disease)",
    "f.physician": "Treating physician contact (optional)",
    "f.obsType": "What is measured", "f.value": "Value", "f.unit": "Unit",
    "f.medName": "Medicine name", "f.freq": "Times per day / how to take", "f.days": "For how many days",
    "f.tier": "Medicine type", "f.substance": "Allergic to", "f.reaction": "Reaction", "f.severity": "Severity",
    "st.active": "Active", "st.resolved": "Resolved", "st.chronic": "Chronic", "st.stopped": "Stopped",
    "tier.otc-self-care": "Common (self-care)", "tier.requires-consult": "Needs a doctor's advice",
    "sev.mild": "Mild", "sev.moderate": "Moderate", "sev.severe": "Severe",
    "btn.save": "Save", "btn.update": "Update", "btn.cancel": "Cancel",
    "err.condition": "Please enter the condition name.", "err.observation": "Please enter what is measured and the value.",
    "err.medicine": "Please enter the medicine name.", "err.allergy": "Please enter what you are allergic to.",
    "err.denied": "You do not have permission to change this member's health records.",
  },
};

export function t(key) {
  const d = DICT[current] || DICT.bn;
  return d[key] !== undefined ? d[key] : (DICT.bn[key] !== undefined ? DICT.bn[key] : key);
}
