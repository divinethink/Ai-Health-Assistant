// src/health/reports/pdfLines.js
//
// pdf.js-এর getTextContent() items → আসল "সারি" (line)। আগে সব item একটাই " "-জোড়া স্ট্রিং হতো, ফলে
// পুরো পাতা এক লাইন হয়ে যেত — আর reportParsing-এর লাইন-ভিত্তিক নিয়ম (যেমন HPF-সারি বাদ) পুরো পাতাই
// বাদ দিত (ইউরিন রিপোর্টে কিছুই শনাক্ত হতো না)। এখানে item-এর y-অবস্থান (transform[5]) ধরে সারি বানানো হয়,
// প্রতি সারিতে x অনুযায়ী সাজিয়ে। Pure logic — pdf.js import নেই, তাই node-এ টেস্টযোগ্য।

const Y_TOLERANCE = 2.5; // একই সারির baseline-এর সহনীয় ফারাক

/**
 * @param {Array<{str?: string, transform?: number[], width?: number}>} items
 * @returns {string[]} উপর থেকে নিচে সারি, প্রতিটা সারির ভেতরে বাঁ থেকে ডানে
 */
export function buildPdfLines(items) {
  const cells = (items || [])
    .filter((it) => it && typeof it.str === "string" && it.str.trim() !== "" && Array.isArray(it.transform))
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }));
  cells.sort((a, b) => b.y - a.y);

  const rows = [];
  for (const c of cells) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - c.y) <= Y_TOLERANCE) last.cells.push(c);
    else rows.push({ y: c.y, cells: [c] });
  }

  return rows.map((row) => {
    row.cells.sort((a, b) => a.x - b.x);
    let out = "";
    let prevEnd = null;
    for (const c of row.cells) {
      const txt = c.str.trim();
      // আগের item-এর ঠিক গায়ে লাগানো হলে (এক শব্দ ভেঙে গেলে) স্পেস ছাড়া; নইলে এক স্পেস
      out += prevEnd !== null && c.x - prevEnd <= 0.5 ? txt : (out ? " " : "") + txt;
      prevEnd = c.x + c.w;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}
