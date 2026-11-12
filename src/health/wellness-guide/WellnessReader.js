// Wellness Reader — ব্লগ পোস্টের ইপাব-স্টাইল পড়ার মোড (owner-request, ২০২৬-১১-১২):
// ফুল-স্ক্রিন, দুই-আঙুল পিঞ্চ-জুম (ফন্ট-সাইজ), থিম, এবং প্রতি সদস্যের নিজস্ব
// আন্ডারলাইন/হাইলাইট (Firestore: wellnessGuideMarks — শুধু নিজের ডেটা)।
// কোনো AI/dose logic নেই; পোস্টের মূল body অপরিবর্তিত থাকে।

import { getMarks, saveMarks } from "./wellnessGuideData.js";

const { useState, useEffect, useRef, useMemo } = React;

const MAX_MARKS = 300;
const FONT_MIN = 12;
const FONT_MAX = 38;
const COLORS = ["#FFF176", "#C8E6C9", "#BBDEFB", "#F8BBD0"];
const THEMES = [
  { bg: "#FFFFFF", fg: "#1F2D2A", bar: "#EEF5F0" },
  { bg: "#F4ECD8", fg: "#3B2F1E", bar: "#E8DCC0" },
  { bg: "#1E2423", fg: "#D8E2DE", bar: "#2A3331" },
];

function lsGet(k, d) { try { const v = window.localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } }

// পোস্টের পূর্ণ টেক্সট ([MORE] বাদ দিয়ে) — মার্কের offset এই টেক্সটের উপর।
export function readerText(post) {
  const body = post.body || "";
  const i = body.indexOf("[MORE]");
  return i === -1 ? body : (body.slice(0, i).trim() + "\n\n" + body.slice(i + 6).trim()).trim();
}

function buildSegments(text, marks) {
  const cuts = new Set([0, text.length]);
  marks.forEach((m) => { cuts.add(m.s); cuts.add(m.e); });
  const pts = Array.from(cuts).sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = pts[i + 1];
    if (e <= s) continue;
    segs.push({ s, e, covering: marks.filter((m) => m.s <= s && m.e >= e) });
  }
  return segs;
}

function segOf(node) {
  const el = node && node.nodeType === 3 ? node.parentElement : node;
  return el && el.closest ? el.closest("[data-s]") : null;
}

function pointOffset(root, node, off) {
  const seg = segOf(node);
  if (seg && root.contains(seg)) {
    if (node.nodeType === 3) return Number(seg.dataset.s) + off;
    return off === 0 ? Number(seg.dataset.s) : Number(seg.dataset.e);
  }
  if (node.nodeType === 1) {
    const kids = node.querySelectorAll("[data-s]");
    if (!kids.length) return null;
    const child = node.childNodes[off];
    if (child) { const t = child.nodeType === 1 ? (child.matches("[data-s]") ? child : child.querySelector("[data-s]")) : null; if (t) return Number(t.dataset.s); }
    return Number(kids[kids.length - 1].dataset.e);
  }
  return null;
}

function readSelection(root) {
  const sel = window.getSelection();
  if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  let s = pointOffset(root, r.startContainer, r.startOffset);
  let e = pointOffset(root, r.endContainer, r.endOffset);
  if (s === null || e === null) return null;
  if (s > e) { const t = s; s = e; e = t; }
  return e > s ? { s, e } : null;
}

export function WellnessReader({ post, uid, onClose }) {
  const text = useMemo(() => readerText(post), [post]);
  const [marks, setMarks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(null);
  const [activeIds, setActiveIds] = useState(null);
  const [font, setFont] = useState(() => Math.min(FONT_MAX, Math.max(FONT_MIN, Number(lsGet("wgReaderFont", 18)) || 18)));
  const [themeIdx, setThemeIdx] = useState(() => Number(lsGet("wgReaderTheme", 0)) % THEMES.length || 0);
  const contentRef = useRef(null);
  const fontRef = useRef(font);
  fontRef.current = font;
  const theme = THEMES[themeIdx];

  useEffect(() => {
    let alive = true;
    getMarks(uid, post.id)
      .then((list) => { if (alive) { setMarks(list); setLoaded(true); } })
      .catch((e) => { if (alive) { setErr(e.message || String(e)); setLoaded(true); } });
    return () => { alive = false; };
  }, [uid, post.id]);

  // পোস্ট এডিট হয়ে গেলে যে মার্কের টেক্সট আর মেলে না, সেটা দেখানো হয় না (ডেটা মোছা হয় না)।
  const validMarks = useMemo(
    () => marks.filter((m) => m.s >= 0 && m.e > m.s && m.e <= text.length && text.slice(m.s, m.e) === m.t),
    [marks, text]
  );
  const segs = useMemo(() => buildSegments(text, validMarks), [text, validMarks]);

  // দুই-আঙুল পিঞ্চ → ফন্ট-সাইজ
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    let d0 = 0, f0 = 18;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e) => { if (e.touches.length === 2) { d0 = dist(e.touches); f0 = fontRef.current; } };
    const tm = (e) => {
      if (e.touches.length === 2 && d0 > 0) {
        e.preventDefault();
        setFont(Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((f0 * dist(e.touches) / d0) * 2) / 2)));
      }
    };
    const te = (e) => { if (e.touches.length < 2 && d0) { d0 = 0; lsSet("wgReaderFont", fontRef.current); } };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te, { passive: true });
    el.addEventListener("touchcancel", te, { passive: true });
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchmove", tm);
      el.removeEventListener("touchend", te);
      el.removeEventListener("touchcancel", te);
    };
  }, []);

  // সিলেকশন ট্র্যাক
  useEffect(() => {
    const h = () => {
      const r = readSelection(contentRef.current);
      if (r) { setPending(r); setActiveIds(null); } else setPending(null);
    };
    document.addEventListener("selectionchange", h);
    return () => document.removeEventListener("selectionchange", h);
  }, []);

  function changeFont(delta) {
    const f = Math.min(FONT_MAX, Math.max(FONT_MIN, font + delta));
    setFont(f); lsSet("wgReaderFont", f);
  }
  function cycleTheme() {
    const i = (themeIdx + 1) % THEMES.length;
    setThemeIdx(i); lsSet("wgReaderTheme", i);
  }

  async function commit(next) {
    const prev = marks;
    setMarks(next); setErr(null);
    try { await saveMarks(uid, post.id, next); }
    catch (e) { setMarks(prev); setErr("সেভ হয়নি: " + (e.message || String(e))); }
  }

  function addMark(kind, color) {
    if (!pending || marks.length >= MAX_MARKS) { if (pending) setErr("সর্বোচ্চ " + MAX_MARKS + "টি মার্ক রাখা যায়।"); return; }
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), s: pending.s, e: pending.e, t: text.slice(pending.s, pending.e), k: kind, c: color || null };
    const sel = window.getSelection(); if (sel) sel.removeAllRanges();
    setPending(null);
    commit(marks.concat([m]));
  }

  function removeActive() {
    if (!activeIds) return;
    const ids = activeIds;
    setActiveIds(null);
    commit(marks.filter((m) => ids.indexOf(m.id) === -1));
  }

  function onContentClick(e) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const seg = e.target.closest ? e.target.closest("[data-m]") : null;
    setActiveIds(seg ? seg.dataset.m.split(",") : null);
  }

  const keep = (e) => e.preventDefault(); // বাটনে চাপলে সিলেকশন হারাবে না
  const barBtn = (extra) => ({ minHeight: "40px", minWidth: "40px", borderRadius: "10px", border: "1px solid rgba(128,128,128,0.5)", background: "transparent", color: theme.fg, fontSize: "15px", cursor: "pointer", ...extra });

  const header = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", background: theme.bar, color: theme.fg } },
    React.createElement("button", { type: "button", onClick: onClose, "aria-label": "বন্ধ করুন", style: barBtn({ fontWeight: 700 }) }, "✕"),
    React.createElement("div", { style: { flex: 1, fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, post.title),
    React.createElement("button", { type: "button", onClick: () => changeFont(-2), "aria-label": "ছোট", style: barBtn({ fontSize: "13px" }) }, "A−"),
    React.createElement("button", { type: "button", onClick: () => changeFont(2), "aria-label": "বড়", style: barBtn({ fontSize: "17px" }) }, "A+"),
    React.createElement("button", { type: "button", onClick: cycleTheme, "aria-label": "থিম", style: barBtn() }, "◐")
  );

  const body = React.createElement(
    "div", {
      ref: contentRef, onClick: onContentClick,
      style: { flex: 1, overflowY: "auto", padding: "16px 18px", touchAction: "pan-y", WebkitUserSelect: "text", userSelect: "text", fontSize: font + "px", lineHeight: 1.9, whiteSpace: "pre-wrap", wordBreak: "break-word", color: theme.fg, background: theme.bg },
    },
    segs.map((g) => {
      const hl = g.covering.filter((m) => m.k === "hl").pop();
      const ul = g.covering.some((m) => m.k === "ul");
      const style = {};
      if (hl) style.background = hl.c || COLORS[0];
      if (hl && themeIdx === 2) style.color = "#1F2D2A";
      if (ul) { style.textDecoration = "underline"; style.textDecorationThickness = "2px"; style.textUnderlineOffset = "3px"; }
      const props = { key: g.s, "data-s": g.s, "data-e": g.e, style };
      if (g.covering.length) props["data-m"] = g.covering.map((m) => m.id).join(",");
      return React.createElement("span", props, text.slice(g.s, g.e));
    }),
    !validMarks.length && marks.length > 0 && React.createElement("div", { style: { marginTop: "12px", fontSize: "12px", opacity: 0.7 } }, "লেখা বদলে যাওয়ায় পুরনো কিছু মার্ক এখন দেখানো হচ্ছে না।")
  );

  let tool;
  if (pending) {
    tool = React.createElement(
      "div", { style: { display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" } },
      COLORS.map((c) => React.createElement("button", { key: c, type: "button", onPointerDown: keep, onClick: () => addMark("hl", c), "aria-label": "হাইলাইট", style: barBtn({ background: c, border: "1px solid #888" }) })),
      React.createElement("button", { type: "button", onPointerDown: keep, onClick: () => addMark("ul"), style: barBtn({ textDecoration: "underline", fontWeight: 600 }) }, "U আন্ডারলাইন")
    );
  } else if (activeIds) {
    tool = React.createElement(
      "div", { style: { display: "flex", gap: "8px", justifyContent: "center" } },
      React.createElement("button", { type: "button", onClick: removeActive, style: barBtn({ color: "#C0392B", border: "1px solid #C0392B", padding: "0 12px" }) }, "এই মার্ক মুছুন"),
      React.createElement("button", { type: "button", onClick: () => setActiveIds(null), style: barBtn({ padding: "0 12px" }) }, "থাক")
    );
  } else {
    tool = React.createElement("div", { style: { textAlign: "center", fontSize: "13px", opacity: 0.75 } }, loaded ? "লেখা সিলেক্ট করে হাইলাইট/আন্ডারলাইন করুন · দুই আঙুলে জুম" : "মার্ক লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: theme.bg, fontFamily: "'Hind Siliguri', sans-serif" } },
    header,
    body,
    React.createElement(
      "div", { style: { padding: "8px 10px", background: theme.bar, color: theme.fg, borderTop: "1px solid rgba(128,128,128,0.3)" } },
      err && React.createElement("div", { style: { color: "#C0392B", fontSize: "13px", marginBottom: "4px", textAlign: "center" } }, err),
      tool
    )
  );
}
