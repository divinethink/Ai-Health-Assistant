// src/health/reports/ocrExtraction.js
//
// P5 — Report Intelligence — Client-side OCR (Roadmap §8 পাইপলাইন:
// "Scanned/image হলে: preprocessing → client-side OCR", Tesseract.js eng+ben)।
//
// রাউটিং-সিদ্ধান্ত (কোন file OCR পাবে, কোনটা manual-entry পাবে — হাতে-লেখা
// report OCR পাবে না, roadmap §8) এই module নিজে নেয় না — caller (upload/
// verification UI) সিদ্ধান্ত নিয়ে এই function-গুলো call করবে। এই module
// সম্পূর্ণ standalone — existing document-upload flow অপরিবর্তিত।
//
// দুইটা entry-point:
//   ocrImageFile(file, onProgress)   → সরাসরি uploaded ছবি (jpg/png)
//   ocrPdfPages(file, onProgress)    → scanned/image-based PDF (pdfTextExtraction.js
//                                       থেকে hasTextLayer:false এলে ব্যবহার্য)
//
// ধাপ ৪ (OCR আপগ্রেড): ফোনের ছবির প্রিপ্রসেসিং (EXIF দিক সোজা, ~১৮০০px, grayscale,
// কনট্রাস্ট-স্ট্রেচ), ছবির মান-মাপ (ঝাপসা/অন্ধকার), ফল খারাপ হলে অন্য সেটিংয়ে
// (binarize + PSM 6) দ্বিতীয়বার চালিয়ে ভালোটা নেওয়া। pure logic: ocrQuality.js।
// eng+ben ডেটা আগের মতোই browser IndexedDB-তে cache হয়।
//
// নোট: Tesseract.js প্রথমবার eng+ben trained-data (~কয়েক MB) CDN থেকে ডাউনলোড
// করে browser IndexedDB-তে cache করে — পরবর্তী ব্যবহারে আর ডাউনলোড লাগে না।
// এটা zero-cost/client-side pipeline নীতির (roadmap §8.0) সাথে সংগতিপূর্ণ,
// কোনো paid OCR API ব্যবহার হচ্ছে না।

import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { grayFromRGBA, qualityMetrics, judgeQuality, stretchContrast, binarize, resultScore, isPoorResult } from "./ocrQuality.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const LANGS = "eng+ben";
const TARGET_SIDE = 1800; // ছবির লম্বা দিক ~১৮০০px (ছোট হলে বড়, বড় হলে ছোট)
const MAX_UPSCALE = 3;

async function renderPdfPagesToCanvases(file, scale) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const canvases = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// ফোনের ছবি → canvas। EXIF-ঘোরানো ছবি সোজা করে (imageOrientation "from-image"), আকার ~১৮০০px।
async function imageFileToCanvas(file) {
  let source = null, objectUrl = null, w = 0, h = 0;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (_e) {
    try { source = await createImageBitmap(file); } catch (_e2) { source = null; }
  }
  if (source) { w = source.width; h = source.height; }
  else { // পুরনো ব্রাউজার: <img> (আধুনিক ব্রাউজার EXIF নিজেই মানে)
    objectUrl = URL.createObjectURL(file);
    source = new Image();
    source.src = objectUrl;
    await source.decode();
    w = source.naturalWidth; h = source.naturalHeight;
  }
  try {
    const scale = Math.min(TARGET_SIDE / Math.max(w, h), MAX_UPSCALE);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; // স্বচ্ছ PNG-র জমি সাদা
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    if (source && source.close) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// grayscale + কনট্রাস্ট-স্ট্রেচ। ছবির মান (স্ট্রেচের আগের মান থেকে) আলাদা ফেরত।
function prepareCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = grayFromRGBA(imageData.data);
  const quality = judgeQuality(qualityMetrics(gray, canvas.width, canvas.height));
  stretchContrast(gray);
  paintGray(ctx, imageData, gray);
  return { canvas, quality };
}

function paintGray(ctx, imageData, gray) {
  const d = imageData.data;
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = gray[i]; d[j + 3] = 255; }
  ctx.putImageData(imageData, 0, 0);
}

// দ্বিতীয় চেষ্টার জন্য: কালো/সাদা (Otsu) কপি
function binarizedCopy(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, copy.width, copy.height);
  const gray = grayFromRGBA(imageData.data);
  binarize(gray);
  paintGray(ctx, imageData, gray);
  return copy;
}

async function recognizeAll(worker, sources) {
  const pages = [];
  for (const source of sources) {
    const { data } = await worker.recognize(source);
    pages.push({ text: (data.text || "").trim(), confidence: data.confidence ?? 0 });
  }
  const text = pages.map((p) => p.text).filter(Boolean).join("\n\n").trim();
  const confidence = pages.length > 0 ? pages.reduce((s, p) => s + p.confidence, 0) / pages.length : 0;
  return { text, confidence, pages };
}

// প্রতিটা document-level call-এ নতুন worker তৈরি ও শেষে terminate (আগের মতোই)।
// প্রথম চেষ্টা (grayscale+স্ট্রেচ, PSM auto) খারাপ হলে দ্বিতীয় চেষ্টা (binarize, PSM 6);
// scoreText(text) → মিলে-যাওয়া মানের সংখ্যা (ঐচ্ছিক) — দুইটার ভালোটা নেওয়া হয়।
async function runOcr(prepared, onProgress, scoreText) {
  const span = { base: 0, size: 1 };
  const worker = await createWorker(LANGS, 1, {
    logger: onProgress
      ? (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            onProgress(span.base + span.size * m.progress);
          }
        }
      : undefined,
  });
  try {
    const canvases = prepared.map((p) => p.canvas);
    const quality = prepared[0] ? prepared[0].quality : { ok: true, reasons: [] };
    const matched = (r) => (scoreText ? scoreText(r.text) : null);

    span.size = 0.6;
    let best = await recognizeAll(worker, canvases);
    let bestMatched = matched(best);
    let attempts = 1;

    if (isPoorResult({ confidence: best.confidence, matchedCount: bestMatched })) {
      span.base = 0.6; span.size = 0.4;
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      const second = await recognizeAll(worker, canvases.map(binarizedCopy));
      const secondMatched = matched(second);
      attempts = 2;
      if (resultScore({ confidence: second.confidence, matchedCount: secondMatched }) > resultScore({ confidence: best.confidence, matchedCount: bestMatched })) {
        best = second; bestMatched = secondMatched;
      }
    }
    if (onProgress) onProgress(1);
    return { text: best.text, confidence: best.confidence, pages: best.pages, matchedCount: bestMatched, quality, attempts };
  } finally {
    await worker.terminate();
  }
}

/**
 * সরাসরি uploaded image (jpg/png) OCR করে।
 * @param {File} file
 * @param {(progress: number) => void} [onProgress] - 0-1 progress (ঐচ্ছিক, UI progress-bar)
 * @param {{ scoreText?: (text: string) => number }} [options] - মিলে-যাওয়া মান গোনার ফাংশন (ঐচ্ছিক)
 * @returns {Promise<{ text: string, confidence: number, matchedCount: number|null, quality: { ok: boolean, reasons: string[] }, attempts: number }>}
 */
export async function ocrImageFile(file, onProgress, { scoreText } = {}) {
  const canvas = await imageFileToCanvas(file);
  return runOcr([prepareCanvas(canvas)], onProgress, scoreText);
}

/**
 * Scanned/image-based PDF-এর প্রতিটা page render+OCR করে সম্মিলিত text ফেরত দেয়।
 * @param {File} file - PDF file
 * @param {(progress: number) => void} [onProgress]
 * @param {{ scale?: number, scoreText?: (text: string) => number }} [options] - render-scale (default 2)
 * @returns {Promise<{ text: string, confidence: number, pages: Array<{ text: string, confidence: number }>, matchedCount: number|null, quality: object, attempts: number }>}
 */
export async function ocrPdfPages(file, onProgress, { scale = 2, scoreText } = {}) {
  const canvases = await renderPdfPagesToCanvases(file, scale);
  return runOcr(canvases.map(prepareCanvas), onProgress, scoreText);
}
