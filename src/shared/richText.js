// AI উত্তরের হালকা ফরম্যাটিং (শুধু display) — **বোল্ড** → <strong>, বাকি টেক্সট অপরিবর্তিত।
// dangerouslySetInnerHTML নেই (XSS-নিরাপদ); stored/AI মূল টেক্সট বদলায় না।
// ⚠ দিয়ে শুরু হওয়া লাইন লাল সতর্কতা-বক্সে দেখায় (লাল = সতর্কতা/danger-এ reserved)।
function boldNodes(s) {
  const parts = s.split(/\*\*([^*\n]+?)\*\*/g);
  if (parts.length === 1) return s;
  return parts.map((p, i) => (i % 2 === 1 ? React.createElement("strong", { key: i }, p) : p));
}

const WARN_STYLE = { display: "block", background: "#FDECEA", color: "#9B1C1C", border: "1px solid #E5A3A0", borderRadius: "10px", padding: "8px 10px", margin: "6px 0" };

export function renderRichText(text) {
  const s = String(text == null ? "" : text);
  if (!/(^|\n)\s*⚠/.test(s)) return boldNodes(s);
  const lines = s.split("\n");
  return lines.map((ln, i) => (/^\s*⚠/.test(ln)
    ? React.createElement("span", { key: i, style: WARN_STYLE }, boldNodes(ln))
    : React.createElement("span", { key: i }, boldNodes(ln), i < lines.length - 1 ? "\n" : null)));
}

// Doctor-export (DOCX/print)-এর জন্য: ** চিহ্ন সরিয়ে প্লেইন টেক্সট।
export function stripBoldMarks(text) {
  return String(text == null ? "" : text).replace(/\*\*([^*\n]+?)\*\*/g, "$1");
}
