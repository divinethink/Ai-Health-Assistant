// Global safety-net: কোনো uncaught error/promise-rejection হলে blank
// white-page না দেখিয়ে error-টেক্সট সরাসরি স্ক্রিনে দেখানো — non-coder
// owner-এর জন্য devtools ছাড়াই debug করার সুবিধার্থে (Walking Skeleton-এ
// শুধু, feature কোড না)।
function showBootError(label, err) {
  const root = document.getElementById("root");
  if (!root) return;
  const box = document.createElement("div");
  box.style.cssText =
    "padding:16px;margin:12px;border:2px solid #C0392B;border-radius:8px;" +
    "background:#FDECEA;color:#7A1F14;font-family:monospace;font-size:13px;" +
    "white-space:pre-wrap;word-break:break-word;";
  box.textContent = "[" + label + "]\n" + (err && err.message ? err.message : String(err));
  root.appendChild(box);
}

window.addEventListener("error", (e) => showBootError("window error", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showBootError("unhandled promise rejection", e.reason));

// globals.js MUST be imported first: it attaches React/ReactDOM/firebase to
// `window` before legacy/app.js (which reads them as bare globals,
// DailyTask pattern reused) executes. Import order below = evaluation order.
import "./globals.js";
import "./legacy/app.js";
