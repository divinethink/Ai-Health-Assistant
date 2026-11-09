// ভিজিটিং-কার্ডের OCR টেক্সট → ডাক্তারের ফিল্ড (pure, নিয়মভিত্তিক; AI/নেটওয়ার্ক নেই)।
// ফল শুধু "অনুমান" — UI এটা খালি ঘরে পূর্বপূরণ করে ও ব্যবহারকারীকে যাচাই করতে বলে।
// ক্যাটেগরির key doctorDetailsData.js-এর DOCTOR_CATEGORIES-এর সাথে মেলানো।

const BN = "০১২৩৪৫৬৭৮৯";
const toAscii = (s) => String(s || "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

// নির্দিষ্ট আগে, সাধারণ ("medicine") শেষে।
const CATEGORY_RULES = [
  ["cardiology-neurology", /cardio|heart|neuro|stroke|হৃদ|হার্ট|নিউরো|স্নায়ু/i],
  ["endocrinology-diabetology", /endocrin|diabet|thyroid|hormone|ডায়াবেটিস|হরমোন|থাইরয়েড/i],
  ["obgyn", /gyn|obstet|\bobs\b|maternity|প্রসূতি|স্ত্রীরোগ|গাইনি/i],
  ["pediatrics-neonatology", /pediatr|paediatr|neonat|child specialist|শিশু/i],
  ["physical-medicine-rheumatology", /rheumat|physical medicine|physiotherap|বাত|ফিজিক্যাল মেডিসিন/i],
  ["dermatology-ophthalmology-ent-dentistry", /dermat|skin|\bvd\b|ophthal|\beye\b|\bent\b|\bdent|চর্ম|চামড়া|চক্ষু|চোখ|নাক.{0,4}কান|দন্ত|দাঁত/i],
  ["nephrology-urology-pulmonology", /nephro|kidney|urolog|pulmo|chest|asthma|কিডনি|মূত্র|বক্ষ|হাঁপানি/i],
  ["gastro-hepatology-general-surgery", /gastro|hepat|liver|surgeon|surgery|সার্জারি|সার্জন|লিভার|গ্যাস্ট্রো|পরিপাক/i],
  ["ortho-trauma", /ortho|trauma|bone|spine|অর্থো|হাড়|মেরুদণ্ড/i],
  ["medicine", /medicine|physician|মেডিসিন/i],
];

const NAME_PREFIX = /^(prof\.?|professor|dr\.?|doctor|ডা\.?|ডাঃ|ডাক্তার|অধ্যাপক|প্রফেসর|সহযোগী অধ্যাপক|সহকারী অধ্যাপক|associate professor|assistant professor)(\s|$)/i;
const ORG_RE = /hospital|clinic|medical|diagnostic|centre|center|institute|health|হাসপাতাল|ক্লিনিক|মেডিকেল|ডায়াগনস্টিক|সেন্টার|ইনস্টিটিউট/i;
const ADDR_RE = /\b(road|rd\.?|house|holding|sector|block|floor|lane|avenue|ave\.?|bazar|bazaar|level)\b|রোড|বাড়ি|বাসা|সড়ক|ফ্লোর|তলা|গলি|ব্লক|সেক্টর|বাজার|ঠিকানা|address|chamber|চেম্বার/i;
const LABEL_RE = /^(address|chamber|ঠিকানা|চেম্বার|appointment|phone|mobile|cell|tel|contact|ফোন|মোবাইল|সিরিয়াল|যোগাযোগ|email|web)\s*[:：\-–]?\s*/i;
const PHONE_LINE_RE = /(\+?8?8?0?1[3-9][\d\s\-]{8,12})|phone|mobile|cell|tel|ফোন|মোবাইল|সিরিয়াল|appointment|e-?mail|www\.|@/i;
const TIME_RE = /\b(sat|sun|mon|tue|wed|thu|fri)\b|am\b|pm\b|শনি|রবি|সোম|মঙ্গল|বুধ|বৃহঃ|শুক্র|সকাল|বিকাল|সন্ধ্যা|রাত/i;

const AREAS = [
  // [মিল-প্যাটার্ন, দেখানোর নাম]
  ["dhanmondi|ধানমন্ডি", "ধানমন্ডি"], ["mirpur|মিরপুর", "মিরপুর"], ["uttara|উত্তরা", "উত্তরা"],
  ["gulshan|গুলশান", "গুলশান"], ["banani|বনানী", "বনানী"], ["mohakhali|মহাখালী", "মহাখালী"],
  ["farmgate|ফার্মগেট", "ফার্মগেট"], ["shahbag|শাহবাগ", "শাহবাগ"], ["motijheel|মতিঝিল", "মতিঝিল"],
  ["malibagh|মালিবাগ", "মালিবাগ"], ["moghbazar|mogbazar|মগবাজার", "মগবাজার"], ["panthapath|পান্থপথ", "পান্থপথ"],
  ["kalabagan|কলাবাগান", "কলাবাগান"], ["bashundhara|বসুন্ধরা", "বসুন্ধরা"], ["badda|বাড্ডা", "বাড্ডা"],
  ["rampura|রামপুরা", "রামপুরা"], ["mohammadpur|মোহাম্মদপুর", "মোহাম্মদপুর"], ["shyamoli|শ্যামলী", "শ্যামলী"],
  ["tejgaon|তেজগাঁও", "তেজগাঁও"], ["eskaton|ইস্কাটন", "ইস্কাটন"], ["lalmatia|লালমাটিয়া", "লালমাটিয়া"],
  ["azimpur|আজিমপুর", "আজিমপুর"], ["jatrabari|যাত্রাবাড়ী", "যাত্রাবাড়ী"], ["khilgaon|খিলগাঁও", "খিলগাঁও"],
  ["wari|ওয়ারী", "ওয়ারী"], ["gazipur|গাজীপুর", "গাজীপুর"], ["narayanganj|নারায়ণগঞ্জ", "নারায়ণগঞ্জ"],
  ["chattogram|chittagong|চট্টগ্রাম", "চট্টগ্রাম"], ["sylhet|সিলেট", "সিলেট"], ["rajshahi|রাজশাহী", "রাজশাহী"],
  ["khulna|খুলনা", "খুলনা"], ["barishal|barisal|বরিশাল", "বরিশাল"], ["rangpur|রংপুর", "রংপুর"],
  ["mymensingh|ময়মনসিংহ", "ময়মনসিংহ"], ["cumilla|comilla|কুমিল্লা", "কুমিল্লা"], ["bogura|bogra|বগুড়া", "বগুড়া"],
  ["jashore|jessore|যশোর", "যশোর"], ["dhaka|ঢাকা", "ঢাকা"],
].map(([p, label]) => [new RegExp("(?<![A-Za-z])(?:" + p + ")", "i"), label]);

const clean = (l) => l.replace(/[|_~•●■□]+/g, " ").replace(/\s+/g, " ").trim();

function findPhone(text) {
  const t = toAscii(text);
  const m = t.match(/(?<!\d)(?:\+?88[\s\-]?)?(01[3-9](?:[\s\-]?\d){8})(?!\d)/);
  if (m) return m[1].replace(/\D/g, "");
  const intl = t.match(/(?<!\d)\+?880[\s\-]?(1[3-9](?:[\s\-]?\d){8})(?!\d)/); // +880 1712… (০ ছাড়া)
  if (intl) return "0" + intl[1].replace(/\D/g, "");
  // ল্যান্ডলাইন/অন্য: লেবেলসহ লাইনের প্রথম ৭-১১ অঙ্কের সংখ্যা
  const l = t.match(/(?:phone|tel|ফোন|appointment|সিরিয়াল)[^\d+]{0,8}(\+?[\d][\d\s\-]{6,12}\d)/i);
  if (l) {
    const d = l[1].replace(/\D/g, "");
    if (d.length >= 7 && d.length <= 13) return d;
  }
  return "";
}

/**
 * @param {string} text - OCR টেক্সট
 * @returns {{ name, specialtyCategory, phone, area, hospital, chamberAddress, found: string[] }}
 * কিছু না পেলে সংশ্লিষ্ট ফিল্ড "" (কখনো অনুমানে বানানো হয় না)।
 */
export function parseVisitingCard(text) {
  const out = { name: "", specialtyCategory: "", phone: "", area: "", hospital: "", chamberAddress: "" };
  const lines = String(text || "").split(/\r?\n/).map(clean).filter((l) => l.length >= 2);
  if (!lines.length) return { ...out, found: [] };

  out.phone = findPhone(text);

  // নাম: উপসর্গ-যুক্ত প্রথম লাইন; না পেলে প্রথম দিকের কোনো ছোট "নাম-সদৃশ" লাইন।
  const isNoise = (l) => PHONE_LINE_RE.test(l) || ORG_RE.test(l) || ADDR_RE.test(l) || /\d/.test(l);
  let nameLine = lines.find((l) => NAME_PREFIX.test(l) && !/\d/.test(l));
  if (!nameLine) {
    nameLine = lines.slice(0, 4).find((l) => {
      const w = l.split(" ");
      return w.length >= 2 && w.length <= 5 && !isNoise(l) && !CATEGORY_RULES.some(([, re]) => re.test(l));
    });
  }
  if (nameLine) {
    // নামের লাইনে কমা/ড্যাশের পরের ডিগ্রি (MBBS, FCPS…) বাদ
    out.name = nameLine.split(/[,;]|\s[-–]\s/)[0].replace(/\s(MBBS|BCS|FCPS|MD|MS|FRCS|MRCP|PhD|DCH|DTCD)\b.*$/, "").trim();
  }

  // ক্যাটেগরি: নির্দিষ্ট নিয়ম আগে; পুরো টেক্সটে খোঁজা।
  const whole = lines.join("\n");
  const cat = CATEGORY_RULES.find(([, re]) => re.test(whole));
  if (cat) out.specialtyCategory = cat[0];

  // প্রতিষ্ঠান: প্রতিষ্ঠান-শব্দসহ প্রথম লাইন (ঠিকানা-সদৃশ/ফোন-লাইন নয়)।
  const orgLine = lines.find((l) => ORG_RE.test(l) && !PHONE_LINE_RE.test(l) && l !== nameLine && !/\b(road|rd|house)\b|রোড|বাড়ি/i.test(l) && !CATEGORY_RULES.some(([k, re]) => k !== "medicine" && re.test(l) && l.split(" ").length > 6));
  if (orgLine) out.hospital = orgLine.replace(LABEL_RE, "").trim();

  // ঠিকানা: ঠিকানা-শব্দসহ লাইন (সর্বোচ্চ ২), ফোন/সময়/প্রতিষ্ঠানের লাইন বাদে।
  const addr = lines.filter((l) => l !== nameLine && l !== orgLine && ADDR_RE.test(l) && !TIME_RE.test(l) && !/(\+?8?8?0?1[3-9]\d{8})/.test(toAscii(l)))
    .slice(0, 2).map((l) => l.replace(LABEL_RE, "").trim()).filter(Boolean);
  if (addr.length) out.chamberAddress = addr.join(", ");

  // এলাকা: ঠিকানা (না থাকলে পুরো টেক্সট) থেকে চেনা স্থান; সর্বোচ্চ ২টি (এলাকা, শহর)।
  const areaSrc = out.chamberAddress || whole;
  const hits = AREAS.filter(([re]) => re.test(areaSrc)).map(([, label]) => label);
  if (hits.length) out.area = hits.slice(0, 2).join(", ");

  const found = Object.keys(out).filter((k) => out[k]);
  return { ...out, found };
}
