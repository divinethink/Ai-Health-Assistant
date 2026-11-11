// src/health/doc-ai/mergeFill.js
//
// ধাপ ৪-খ(৪) — AI/নিয়ম-ফল শুধু **খালি ঘরে** বসানো; ব্যবহারকারী বা নিয়মভিত্তিক parser-এর
// আগের মান কখনো বদলায় না। কোন ঘর AI বসিয়েছে তার তালিকা ফেরে (UI-তে হলুদ ট্যাগের জন্য)।
// Pure logic; ইনপুট বদলায় না (নতুন অবজেক্ট ফেরে)।

const isEmpty = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "");

/**
 * একক ফর্ম (যেমন ডাক্তারের কার্ড): current-এর খালি ঘরে incoming বসায়।
 * @returns {{ merged: object, filled: string[] }}
 */
export function mergeIntoEmpty(current, incoming, keys) {
  const merged = { ...(current || {}) };
  const filled = [];
  for (const k of keys || Object.keys(incoming || {})) {
    if (isEmpty(merged[k]) && !isEmpty(incoming?.[k])) { merged[k] = incoming[k]; filled.push(k); }
  }
  return { merged, filled };
}

/**
 * তালিকা (ওষুধ/ল্যাব-মান): existing অক্ষত; incoming থেকে শুধু নতুন (keyFn-এ না-মেলা) ভুক্তি যোগ।
 * existing-এর কোনো ভুক্তি মেলে গেলে তার **খালি** ঘরগুলো (fillKeys) ভরা হয়, অন্য ঘর নয়।
 * @returns {{ items: object[], added: number, filledCells: number }}
 */
export function mergeList(existing, incoming, keyFn, fillKeys = []) {
  const items = (existing || []).map((x) => ({ ...x }));
  const index = new Map(items.map((x, i) => [keyFn(x), i]));
  let added = 0, filledCells = 0;
  for (const inc of incoming || []) {
    const k = keyFn(inc);
    if (!k) continue;
    if (index.has(k)) {
      const cur = items[index.get(k)];
      const aiCells = [];
      for (const f of fillKeys) if (isEmpty(cur[f]) && !isEmpty(inc[f])) { cur[f] = inc[f]; aiCells.push(f); filledCells++; }
      if (aiCells.length) cur.aiFilled = [...(cur.aiFilled || []), ...aiCells];
    } else {
      index.set(k, items.length); items.push({ ...inc }); added++;
    }
  }
  return { items, added, filledCells };
}

export const medicineKey = (m) => normKey(m?.name);
export const labKey = (r) => normKey(r?.name || r?.canonicalNameEn || r?.testId);
