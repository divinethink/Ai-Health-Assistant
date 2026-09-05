// src/health/reports/pdfTextExtraction.js
//
// P5 — Report Intelligence — Text-layer PDF detection ও direct text extraction
// (Roadmap §8 পাইপলাইন: "Text-layer PDF হলে direct text extraction, OCR স্কিপ")।
//
// পদ্ধতি: pdfjs-dist দিয়ে প্রতিটা page-এর embedded text-content বের করা হয়।
// যথেষ্ট text পাওয়া গেলে (scanned/image-based PDF-এ সাধারণত কোনো embedded
// text-layer থাকে না) → hasTextLayer: true, OCR ধাপ স্কিপ করা যাবে।
// অপর্যাপ্ত/কোনো text না পাওয়া গেলে → hasTextLayer: false, পরবর্তী ধাপ
// (client-side OCR, Tesseract.js) প্রয়োজন হবে।
//
// এই module সম্পূর্ণ standalone — কোনো existing document-upload flow
// (src/health/documents/) স্পর্শ করেনি, শুধু ভবিষ্যৎ Report-Intelligence
// verification-UI থেকে call হবে।

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Heuristic threshold — pure image-based/scanned PDF-এ কখনো কখনো কয়েকটা
// stray character (metadata/watermark layer) embedded থাকতে পারে, তাই ছোট
// non-zero count-কেও "no real text layer" ধরা দরকার। Per-page গড় অন্তত এই
// সংখ্যক character থাকলেই সেটা "real text layer" ধরা হবে।
const MIN_CHARS_PER_PAGE = 20;

/**
 * PDF file-এর embedded text-layer detect ও extract করে।
 * @param {File} file - PDF file (আগে থেকেই application/pdf হিসেবে validate করা থাকবে)
 * @returns {Promise<{ hasTextLayer: boolean, text: string, pageCount: number }>}
 */
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || "").join(" ").trim();
    if (pageText) fullText += pageText + "\n";
  }

  const totalChars = fullText.replace(/\s+/g, "").length;
  const hasTextLayer = pdf.numPages > 0 && totalChars / pdf.numPages >= MIN_CHARS_PER_PAGE;

  return {
    hasTextLayer,
    text: hasTextLayer ? fullText.trim() : "",
    pageCount: pdf.numPages,
  };
}
