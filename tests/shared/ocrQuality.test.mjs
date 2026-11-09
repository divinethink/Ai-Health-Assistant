// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { qualityMetrics, judgeQuality, stretchContrast, otsuThreshold, binarize, assessOcr, isPoorResult, resultScore, findDoseConfusions, grayFromRGBA } from "../../src/health/reports/ocrQuality.js";

const W = 64, H = 64;
function striped(period, lo, hi) { const g = new Uint8ClampedArray(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = Math.floor(x / period) % 2 ? lo : hi; return g; }

test("তীক্ষ্ণ ছবি ভালো, ঝাপসা (সমান) ছবিতে blurry", () => {
  assert.deepEqual(judgeQuality(qualityMetrics(striped(1, 20, 240), W, H)).reasons, []);
  const flat = new Uint8ClampedArray(W * H).fill(200);
  assert.ok(judgeQuality(qualityMetrics(flat, W, H)).reasons.includes("blurry"));
});
test("অন্ধকার ছবি dark", () => {
  assert.ok(judgeQuality(qualityMetrics(striped(1, 10, 90), W, H)).reasons.includes("dark"));
});
test("grayFromRGBA", () => {
  const g = grayFromRGBA(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
  assert.deepEqual(Array.from(g), [255, 0]);
});
test("কনট্রাস্ট-স্ট্রেচ ও Otsu/binarize", () => {
  const g = striped(1, 100, 140); stretchContrast(g);
  assert.ok(Math.min(...g) <= 5 && Math.max(...g) >= 250);
  const b = striped(1, 60, 200); const t = otsuThreshold(b);
  assert.ok(t >= 60 && t < 200);
  binarize(b); assert.ok(Array.from(b).every((v) => v === 0 || v === 255));
});
test("সমান-রঙা ছবি স্ট্রেচে অক্ষত", () => {
  const g = new Uint8ClampedArray(100).fill(128); stretchContrast(g); assert.equal(g[0], 128);
});
test("হাতের লেখার সন্দেহ ও দ্বিতীয়-চেষ্টার সিদ্ধান্ত", () => {
  assert.equal(assessOcr({ confidence: 45, matchedCount: 0, textLength: 200 }).suspectHandwriting, true);
  assert.equal(assessOcr({ confidence: 88, matchedCount: 5, textLength: 400 }).suspectHandwriting, false);
  assert.equal(assessOcr({ confidence: 50, matchedCount: 4, textLength: 300 }).suspectHandwriting, false);
  assert.equal(isPoorResult({ confidence: 80, matchedCount: 0 }), true);
  assert.equal(isPoorResult({ confidence: 80, matchedCount: null }), false);
  assert.equal(isPoorResult({ confidence: 50, matchedCount: 3 }), true);
  assert.ok(resultScore({ confidence: 60, matchedCount: 3 }) > resultScore({ confidence: 80, matchedCount: 0 }));
});
test("ডোজ-প্যাটার্ন: O/0, l/1 শুধু চিহ্নিত, ঠিক প্যাটার্ন চিহ্নিত নয়", () => {
  const r = findDoseConfusions("Tab. Napa 5OO mg 1+O+1\nTab. X 500 mg 1+0+1 ০+০+১\nCap Y 1 + l + 1");
  assert.equal(r.length, 3);
  assert.ok(r.some((x) => x.raw === "1+O+1" && x.suggestion === "1+0+1"));
  assert.ok(r.some((x) => x.kind === "strength" && x.raw === "5OO" && x.suggestion === "500"));
  assert.ok(r.some((x) => x.raw === "1 + l + 1" && x.suggestion === "1+1+1"));
});
test("শব্দের ভেতরের/ডিজিটহীন অংশ চিহ্নিত নয়", () => {
  assert.equal(findDoseConfusions("DOSE ISO BOLD O+O+O Omeprazole 20 mg").length, 0);
});
