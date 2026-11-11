// src/health/doc-ai/readDocText.js
//
// ধাপ ৪-ঙ — ফাইল থেকে লেখা পড়ার একটাই পথ (PDF text-layer আগে, নইলে OCR)। আপলোডে একবারই চলে;
// ফলটা `preOcr` হিসেবে প্যানেলে যায় — দুবার OCR নয়। Tesseract/pdf.js lazy import (অ্যাপ-বুট হালকা)।
// ফেরত: { text, ocr|null, method: "direct-text"|"ocr" } — `ocr` = ocrExtraction.js-এর আসল ফল
// (confidence/quality সহ), text-layer PDF-এ null।

export async function readDocumentText(file, { onStage, onProgress } = {}) {
  const stage = (s) => { if (onStage) onStage(s); };
  if (file.type === "application/pdf") {
    stage("extracting");
    const { extractPdfText } = await import("../reports/pdfTextExtraction.js");
    const pdf = await extractPdfText(file);
    if (pdf.hasTextLayer) return { text: pdf.text, ocr: null, method: "direct-text" };
    stage("ocr");
    const { ocrPdfPages } = await import("../reports/ocrExtraction.js");
    const ocr = await ocrPdfPages(file, onProgress);
    return { text: ocr.text, ocr, method: "ocr" };
  }
  if (file.type && file.type.startsWith("image/")) {
    stage("ocr");
    const { ocrImageFile } = await import("../reports/ocrExtraction.js");
    const ocr = await ocrImageFile(file, onProgress);
    return { text: ocr.text, ocr, method: "ocr" };
  }
  throw new Error("শুধু ছবি (jpg/png) বা PDF সমর্থিত।");
}

/** DoctorFieldsRow-এর জন্য: text-layer PDF-এও OCR-সদৃশ আকার */
export function asOcrLike(pre) {
  return pre.ocr || { text: pre.text, confidence: 100, quality: { reasons: [] } };
}
