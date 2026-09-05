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
// নোট: Tesseract.js প্রথমবার eng+ben trained-data (~কয়েক MB) CDN থেকে ডাউনলোড
// করে browser IndexedDB-তে cache করে — পরবর্তী ব্যবহারে আর ডাউনলোড লাগে না।
// এটা zero-cost/client-side pipeline নীতির (roadmap §8.0) সাথে সংগতিপূর্ণ,
// কোনো paid OCR API ব্যবহার হচ্ছে না।

import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const LANGS = "eng+ben";

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

// সাধারণ preprocessing — grayscale conversion, OCR accuracy বাড়ানোর জন্য
// (roadmap §8: "preprocessing → client-side OCR")। heavy/advanced image-
// processing (deskew, binarization ইত্যাদি) ইচ্ছাকৃতভাবে এখানে নেই — MVP-scope,
// প্রয়োজন হলে ভবিষ্যতে যোগ করা যাবে।
function preprocessCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// প্রতিটা document-level call-এ নতুন worker তৈরি ও শেষে terminate — worker
// শেয়ার/cache করা হয়নি (simplicity, memory-leak এড়ানো; পারিবারিক scale-এ
// per-document worker-creation overhead নগণ্য)।
async function runOcrOnSources(sources, onProgress) {
  const worker = await createWorker(LANGS, 1, {
    logger: onProgress
      ? (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            onProgress(m.progress);
          }
        }
      : undefined,
  });

  const pageResults = [];
  try {
    for (const source of sources) {
      const { data } = await worker.recognize(source);
      pageResults.push({ text: (data.text || "").trim(), confidence: data.confidence ?? 0 });
    }
  } finally {
    await worker.terminate();
  }
  return pageResults;
}

/**
 * সরাসরি uploaded image (jpg/png) OCR করে।
 * @param {File} file
 * @param {(progress: number) => void} [onProgress] - 0-1 progress (ঐচ্ছিক, UI progress-bar)
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function ocrImageFile(file, onProgress) {
  const [result] = await runOcrOnSources([file], onProgress);
  return result;
}

/**
 * Scanned/image-based PDF-এর প্রতিটা page render+OCR করে সম্মিলিত text ফেরত দেয়।
 * @param {File} file - PDF file
 * @param {(progress: number) => void} [onProgress]
 * @param {{ scale?: number }} [options] - render-scale (default 2, বেশি হলে accuracy বাড়ে, সময়ও বাড়ে)
 * @returns {Promise<{ text: string, confidence: number, pages: Array<{ text: string, confidence: number }> }>}
 */
export async function ocrPdfPages(file, onProgress, { scale = 2 } = {}) {
  const canvases = (await renderPdfPagesToCanvases(file, scale)).map(preprocessCanvas);
  const pageResults = await runOcrOnSources(canvases, onProgress);
  const text = pageResults.map((p) => p.text).filter(Boolean).join("\n\n").trim();
  const avgConfidence =
    pageResults.length > 0
      ? pageResults.reduce((sum, p) => sum + p.confidence, 0) / pageResults.length
      : 0;
  return { text, confidence: avgConfidence, pages: pageResults };
}
