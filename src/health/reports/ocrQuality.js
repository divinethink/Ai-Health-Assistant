// src/health/reports/ocrQuality.js
//
// ধাপ ৪ — OCR-এর pure helper (DOM/Firebase নেই, node-এ টেস্টযোগ্য):
//   • ছবির মান মাপা (অন্ধকার/ঝাপসা/কম-কনট্রাস্ট) — শুধু নরম সতর্কতার জন্য
//   • কনট্রাস্ট-স্ট্রেচ ও Otsu binarize (দ্বিতীয়-চেষ্টার সেটিং)
//   • OCR ফলাফলের মান-বিচার: কম আত্মবিশ্বাস / হাতের লেখার সন্দেহ
//   • ডোজ-প্যাটার্নে অক্ষর↔ডিজিট গোলমাল (O/0, l/1…) চিহ্নিত করা
//
// **নীতি (roadmap §8, অপরিবর্তিত):** কিছুই চুপচাপ ঠিক করা হয় না — findDoseConfusions
// শুধু "সন্দেহজনক অংশ + সম্ভাব্য মান" ফেরত দেয়, মূল text বদলায় না।

// ---------- ছবির মান ----------

// RGBA (ImageData.data) → ধূসর (০–২৫৫)
export function grayFromRGBA(rgba) {
  const n = Math.floor(rgba.length / 4);
  const gray = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    gray[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return gray;
}

// গড় উজ্জ্বলতা, কনট্রাস্ট (std-dev), তীক্ষ্ণতা (Laplacian-variance)
export function qualityMetrics(gray, w, h) {
  const n = gray.length;
  if (n === 0 || w < 3 || h < 3) return { mean: 0, std: 0, sharpness: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += gray[i];
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (gray[i] - mean) * (gray[i] - mean);
  const std = Math.sqrt(sq / n);
  let lsum = 0, lsq = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      lsum += l; lsq += l * l; cnt++;
    }
  }
  const lmean = lsum / cnt;
  return { mean, std, sharpness: lsq / cnt - lmean * lmean };
}

// সীমা ~১৮০০px-এ নেওয়া ৪টা নমুনা (পরিষ্কার: sharpness ২৯০–৫৬০, mean ২৩৭–২৪৯;
// ইচ্ছাকৃত ঝাপসা: ≈১; ০.৩৫× অন্ধকার: mean ≈৮৫) থেকে — ইচ্ছে করেই উদার, শুধু নরম সতর্কতা।
export const QUALITY_LIMITS = { minMean: 110, minStd: 20, minSharpness: 60 };

export function judgeQuality(m) {
  const reasons = [];
  if (m.mean < QUALITY_LIMITS.minMean) reasons.push("dark");
  else if (m.std < QUALITY_LIMITS.minStd) reasons.push("low-contrast");
  if (m.sharpness < QUALITY_LIMITS.minSharpness) reasons.push("blurry");
  return { ok: reasons.length === 0, reasons };
}

export const QUALITY_MESSAGES = {
  dark: "ছবিটা একটু অন্ধকার",
  "low-contrast": "ছবিতে লেখা আর জমির পার্থক্য কম",
  blurry: "ছবিটা ঝাপসা হতে পারে",
};

// ---------- কনট্রাস্ট-স্ট্রেচ / binarize ----------

function histogramOf(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  return hist;
}

// ১%–৯৯% পার্সেন্টাইল টেনে ০–২৫৫ করা (in-place)। প্রায়-একরঙা ছবিতে কিছু করে না।
export function stretchContrast(gray) {
  const hist = histogramOf(gray);
  const total = gray.length, cut = total * 0.01;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break; } }
  if (hi - lo < 16) return gray;
  const span = hi - lo;
  for (let i = 0; i < total; i++) {
    const v = ((gray[i] - lo) * 255) / span;
    gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return gray;
}

export function otsuThreshold(gray) {
  const hist = histogramOf(gray);
  const total = gray.length;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) sumAll += v * hist[v];
  let wB = 0, sumB = 0, best = 0, thr = 127;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = v; }
  }
  return thr;
}

// গ্রেস্কেল → কালো/সাদা (in-place)
export function binarize(gray) {
  const t = otsuThreshold(gray);
  for (let i = 0; i < gray.length; i++) gray[i] = gray[i] > t ? 255 : 0;
  return gray;
}

// ---------- OCR ফলাফলের মান ----------

// matchedCount: পরিচিত টেস্ট-নামের সাথে কয়টা মান মিলেছে (caller হিসাব করে; জানা না থাকলে null)
export function resultScore({ confidence, matchedCount }) {
  return (confidence || 0) + 10 * Math.min(matchedCount || 0, 10);
}

// প্রথম চেষ্টা খারাপ হলে অন্য সেটিংয়ে দ্বিতীয়বার চালানো হবে
export function isPoorResult({ confidence, matchedCount }) {
  if ((confidence || 0) < 65) return true;
  return matchedCount === 0;
}

// ধাপ ৪: কম আত্মবিশ্বাস + কম নাম-মিল ⇒ হাতের লেখার সন্দেহ ⇒ ম্যানুয়াল ফর্মের পরামর্শ
export function assessOcr({ confidence, matchedCount, textLength }) {
  const c = confidence || 0;
  const lowConfidence = c < 65;
  const few = matchedCount == null ? true : matchedCount <= 1;
  const suspectHandwriting = (c < 60 && few) || ((textLength || 0) > 0 && (textLength || 0) < 20 && few);
  return { lowConfidence, suspectHandwriting };
}

// ---------- ডোজ-প্যাটার্নে অক্ষর/ডিজিট গোলমাল ----------

const CONFUSABLE = { O: "0", o: "0", Q: "0", D: "0", I: "1", l: "1", "|": "1", Z: "2", S: "5", B: "8" };
const DOSE_CH = "[0-9০-৯OoQDIl|ZSB]";
// ১+০+১ / 1 + 0 + 1 ধাঁচ (শব্দের মাঝখানে নয়)
const FREQ_RE = new RegExp("(?<![A-Za-z0-9০-৯])" + DOSE_CH + "\\s*[+＋]\\s*" + DOSE_CH + "\\s*[+＋]\\s*" + DOSE_CH + "(?![A-Za-z0-9০-৯])", "g");
// শক্তি: 5OO mg, 1OO mg, 2O ml — অন্তত একটা ডিজিট ও একটা গোলমেলে অক্ষর
const STRENGTH_RE = /(?<![A-Za-z0-9০-৯.])(?=[0-9OoIl]*[0-9])(?=[0-9OoIl]*[OoIl])[0-9OoIl]{2,5}(?=\s?(?:mg|mcg|ml|gm|g)\b)/gi;

function suggest(raw) {
  return raw.replace(/\s+/g, "").split("").map((ch) => (CONFUSABLE[ch] !== undefined ? CONFUSABLE[ch] : ch)).join("");
}
const hasConfusable = (s) => /[OoQDIl|ZSB]/.test(s);
const hasDigit = (s) => /[0-9০-৯]/.test(s);

/**
 * @returns {Array<{ raw: string, suggestion: string, kind: "frequency"|"strength", line: string }>}
 * শুধু চিহ্নিত করে; text বদলায় না।
 */
export function findDoseConfusions(text) {
  const out = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    for (const m of line.matchAll(FREQ_RE)) {
      if (hasConfusable(m[0]) && hasDigit(m[0])) out.push({ raw: m[0].trim(), suggestion: suggest(m[0]).replace(/\+/g, "+"), kind: "frequency", line: line.trim() });
    }
    for (const m of line.matchAll(STRENGTH_RE)) {
      const raw = m[0];
      if (hasConfusable(raw) && hasDigit(raw)) out.push({ raw, suggestion: suggest(raw), kind: "strength", line: line.trim() });
    }
  }
  return out;
}
