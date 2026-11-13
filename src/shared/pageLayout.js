// পেজ-কার্ড কাস্টমাইজ (App Creator-এর গ্লোবাল ডিজাইন) — pure logic, React/DB নেই।
// অ্যাপ-ক্রিয়েটর যে ক্রম/দৃশ্যমানতা/ভাঁজ সেভ করেন, সব সদস্য সেটাই দেখেন।
// না থাকলে/অবৈধ হলে ডিফল্ট = আগের আচরণ হুবহু। অচেনা/ডুপ্লিকেট id বাদ; নতুন কার্ড ডিফল্ট জায়গায় যোগ হয়।
// fold: fixed = সবসময় খোলা(মোড়ানো হয় না); open/closed = ভাঁজযোগ্য, শুরুতে খোলা/বন্ধ।

export const FOLDS = ["fixed", "open", "closed"];
export const FOLD_LABEL = { fixed: "স্থির (সবসময় খোলা)", open: "খোলা থাকবে", closed: "বন্ধ থাকবে" };
export const MAX_CARDS_PER_ZONE = 20;

const d = (id, title, defaultFold) => ({ id, title, defaultFold });

// পেজ → { label, zones: { zoneId: { label, cards[] } } }। ক্রম ও ডিফল্ট fold = বর্তমান পেজের হুবহু আচরণ।
export const PAGE_DEFS = {
  home: {
    label: "হোম",
    zones: {
      main: {
        label: "হোম-পেজের কার্ড",
        cards: [
          d("hero", "আজকের টার্গেট ও ক্যালরি", "fixed"),
          d("macros", "আজকের পুষ্টির হিসাব", "fixed"),
          d("alert", "এলার্জি/রোগ সতর্কতা", "fixed"),
          d("rings", "ব্যায়াম · ঘুম · স্টেপ", "fixed"),
          d("waterFood", "পানি ও খাবার-যোগ", "fixed"),
          d("week", "এই সপ্তাহ", "fixed"),
          d("meds", "আজকের ওষুধ", "fixed"),
          d("foodHead", "খাবার-লগ ও পেট ডায়েরি", "fixed"),
          d("slots", "বেলা-ভিত্তিক খাবার", "fixed"),
        ],
      },
    },
  },
  trend: {
    label: "ট্রেন্ড",
    zones: {
      top: { label: "উপরের অংশ", cards: [d("heatmap", "হিটম্যাপ — শেষ ৩ মাস", "fixed")] },
      week: {
        label: "সপ্তাহ-ভিউয়ের কার্ড",
        cards: [
          d("weight", "ওজন", "fixed"),
          d("calSleep", "ক্যালরি ও ঘুম", "fixed"),
          d("weekGoal", "এই সপ্তাহের লক্ষ্য", "fixed"),
          d("review", "সাপ্তাহিক রিভিউ", "fixed"),
        ],
      },
    },
  },
};

export const PAGE_IDS = Object.keys(PAGE_DEFS);
export const zonesOf = (page) => (PAGE_DEFS[page] ? Object.keys(PAGE_DEFS[page].zones) : []);
const defsOf = (page, zone) => (PAGE_DEFS[page] && PAGE_DEFS[page].zones[zone] ? PAGE_DEFS[page].zones[zone].cards : []);

export function cardTitle(page, zone, id) {
  const f = defsOf(page, zone).find((x) => x.id === id);
  return f ? f.title : id;
}

export function defaultCards(page, zone) {
  return defsOf(page, zone).map((x) => ({ id: x.id, visible: true, fold: x.defaultFold }));
}

/** পেজের ডিফল্ট লেআউট: { zoneId: cards[] } */
export function defaultPage(page) {
  const out = {};
  zonesOf(page).forEach((z) => { out[z] = defaultCards(page, z); });
  return out;
}

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** সেভ-করা তালিকা → বৈধ তালিকা। ভুল কার্ড বাদ(ডিফল্টে ফেরে), বাকি অক্ষত; নতুন কার্ড ঠিক আগের পরিচিত কার্ডের পরে বসে। */
export function sanitizeCards(page, zone, raw) {
  const defs = defsOf(page, zone);
  const known = new Set(defs.map((x) => x.id));
  const seen = new Set();
  const out = [];
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, MAX_CARDS_PER_ZONE)) {
      if (!isObj(item)) continue;
      const { id, visible, fold } = item;
      if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue;
      if (typeof visible !== "boolean" || !FOLDS.includes(fold)) continue;
      seen.add(id);
      out.push({ id, visible, fold });
    }
  }
  defs.forEach((x, i) => {
    if (seen.has(x.id)) return;
    const card = { id: x.id, visible: true, fold: x.defaultFold };
    let at = -1;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex((c) => c.id === defs[j].id);
      if (k >= 0) { at = k; break; }
    }
    if (at >= 0) out.splice(at + 1, 0, card);
    else if (Array.isArray(raw) && raw.length) out.push(card);
    else out.splice(0, 0, card);
    seen.add(x.id);
  });
  return out;
}

/** raw = সেভ-করা পুরো ডকের pages ম্যাপ (বা null); ফেরত = বৈধ পেজ-লেআউট { zone: cards[] } */
export function sanitizePage(page, rawPages) {
  const rp = isObj(rawPages) && isObj(rawPages[page]) ? rawPages[page] : {};
  const out = {};
  zonesOf(page).forEach((z) => { out[z] = sanitizeCards(page, z, rp[z]); });
  return out;
}

/** একটা কার্ড ওপরে(-1)/নিচে(+1); সীমার বাইরে হলে অপরিবর্তিত। নতুন অ্যারে ফেরত। */
export function moveCard(list, id, dir) {
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
  return next;
}

export function updateCard(list, id, patch) {
  return list.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

export function sameLayout(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
