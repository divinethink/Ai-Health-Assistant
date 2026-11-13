// Wellness Reader — ব্লগ পোস্টের ইপাব-স্টাইল পড়ার মোড (owner-request, ২০২৬-১১-১২):
// ফুল-স্ক্রিন, দুই-আঙুল পিঞ্চ-জুম (ফন্ট-সাইজ), থিম, এবং প্রতি সদস্যের নিজস্ব
// আন্ডারলাইন/হাইলাইট (Firestore: wellnessGuideMarks — শুধু নিজের ডেটা)।
// কোনো AI/dose logic নেই; পোস্টের মূল body অপরিবর্তিত থাকে।

import { getMarks, saveMarks, WELLNESS_CATEGORIES, formatAgeOrMonthRange } from "./wellnessGuideData.js";

const { useState, useEffect, useRef, useMemo } = React;

// বাংলা অঙ্ক (০-৯) পরিষ্কার দেখাতে ডিভাইসের Noto Sans Bengali-কে শুধু অঙ্কের জন্য ব্যবহার (থাকলে);
// না থাকলে আগের ফন্টেই থাকে। একবারই যোগ হয়।
function ensureDigitFont() {
  try {
    if (document.getElementById("wg-digit-font")) return;
    const st = document.createElement("style");
    st.id = "wg-digit-font";
    const src = 'local("Noto Sans Bengali"), local("NotoSansBengali-Regular"), local("Noto Sans Bengali UI")';
    st.textContent = '@font-face{font-family:"WgBnDigits";src:' + src + ';font-weight:400 800;unicode-range:U+09E6-09EF;}';
    document.head.appendChild(st);
  } catch (e) { /* ignore */ }
}

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

// "▌ শিরোনাম" লাইনগুলো (হেডিং) ও রেফারেন্স-অংশের সীমা — শুধু দেখানোর স্টাইলের জন্য;
// টেক্সট/অফসেট অপরিবর্তিত, তাই পুরনো মার্ক ঠিক থাকে।
function analyzeText(text) {
  const heads = [];
  const re = /^▌[^\n]*/gm;
  let m;
  while ((m = re.exec(text)) !== null) heads.push({ s: m.index, e: m.index + m[0].length, label: m[0] });
  let refS = -1, refE = text.length;
  for (let i = 0; i < heads.length; i++) {
    if (/^▌\s*রেফারেন্স/.test(heads[i].label)) {
      refS = heads[i].s;
      for (let j = i + 1; j < heads.length; j++) { refE = heads[j].s; break; }
      break;
    }
  }
  return { heads, refS, refE };
}

function buildSegments(text, marks, extra) {
  const cuts = new Set([0, text.length]);
  extra.forEach((c) => { if (c >= 0 && c <= text.length) cuts.add(c); });
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

export function WellnessReader({ post, uid, onClose, canManage, onEdit, onTrash }) {
  const text = useMemo(() => readerText(post), [post]);
  const [marks, setMarks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const info = useMemo(() => analyzeText(text), [text]);
  const segs = useMemo(() => {
    const extra = [];
    info.heads.forEach((h) => {
      extra.push(h.s, h.e);
      let k = h.e; while (k < text.length && text[k] === "\n") k++; // হেডিংয়ের পরের ফাঁকা লাইন আলাদা সেগমেন্ট
      extra.push(k);
    });
    if (info.refS !== -1) extra.push(info.refS, info.refE);
    return buildSegments(text, validMarks, extra);
  }, [text, validMarks, info]);
  useEffect(() => { ensureDigitFont(); }, []);
  const [refsOpen, setRefsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const catLabel = (WELLNESS_CATEGORIES.find(([id]) => id === post.category) || [null, ""])[1];
  const rangeLabel = formatAgeOrMonthRange(post);

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
    "div", { style: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", background: theme.bar, color: theme.fg, position: "relative" } },
    React.createElement("button", { type: "button", onClick: onClose, "aria-label": "পিছনে", style: barBtn({ fontWeight: 700 }) }, "←"),
    React.createElement("div", { style: { flex: 1, fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, post.title),
    React.createElement("button", { type: "button", onClick: () => changeFont(-2), "aria-label": "ছোট", style: barBtn({ fontSize: "13px" }) }, "A−"),
    React.createElement("button", { type: "button", onClick: () => changeFont(2), "aria-label": "বড়", style: barBtn({ fontSize: "17px" }) }, "A+"),
    React.createElement("button", { type: "button", onClick: cycleTheme, "aria-label": "থিম", style: barBtn() }, "◐"),
    // শুধু ব্লগ-অ্যাডমিনের জন্য ⋮ মেনু (এডিট / ট্র্যাশে পাঠান); সদস্যরা কিছু দেখেন না।
    canManage && React.createElement("button", { type: "button", onClick: () => setMenuOpen((o) => !o), "aria-label": "আরো অপশন", style: barBtn({ fontWeight: 700, fontSize: "20px" }) }, "⋮"),
    canManage && menuOpen && React.createElement(
      "div", { style: { position: "absolute", top: "100%", right: "10px", zIndex: 5, minWidth: "170px", background: theme.bg, color: theme.fg, border: "1px solid rgba(128,128,128,0.5)", borderRadius: "12px", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", overflow: "hidden" } },
      React.createElement("button", { type: "button", onClick: () => { setMenuOpen(false); onEdit(post); }, style: { display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", border: "none", color: theme.fg, fontSize: "14px", cursor: "pointer" } }, "✏️ এডিট"),
      React.createElement("button", { type: "button", onClick: () => { setMenuOpen(false); onTrash(post); }, style: { display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", border: "none", borderTop: "1px solid rgba(128,128,128,0.3)", color: "#C0392B", fontSize: "14px", cursor: "pointer" } }, "🗑 ট্র্যাশে পাঠান")
    )
  );

  const accent = themeIdx === 2 ? "#7FD1B9" : "#0E7A66";
  const inRefs = (g) => info.refS !== -1 && g.s >= info.refS && g.e <= info.refE;
  let refToggleShown = false;
  const segEls = [];
  segs.forEach((g) => {
    if (inRefs(g) && !refToggleShown) {
      refToggleShown = true;
      segEls.push(React.createElement("button", {
        key: "reftoggle", type: "button", onClick: (e) => { e.stopPropagation(); setRefsOpen((o) => !o); },
        style: { display: "block", width: "100%", textAlign: "left", margin: "18px 0 6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: theme.fg, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
      }, (refsOpen ? "▲ " : "▼ ") + "রেফারেন্স " + (refsOpen ? "লুকান" : "দেখুন")));
    }
    if (inRefs(g) && !refsOpen) return;
    const hl = g.covering.filter((m) => m.k === "hl").pop();
    const ul = g.covering.some((m) => m.k === "ul");
    const headHit = info.heads.find((h) => g.s >= h.s && g.e <= h.e);
    const isHead = !!headHit;
    const style = {};
    if (isHead) {
      style.fontWeight = 700; style.color = accent; style.fontSize = "1.08em";
      // পুরো হেডিং-লাইন একটাই সেগমেন্ট হলে ব্লক — নিচে ছোট ফাঁক (আগের পুরো ফাঁকা লাইনের বদলে)।
      if (g.s === headHit.s && g.e === headHit.e) { style.display = "block"; style.marginBottom = "4px"; }
    }
    // হেডিংয়ের ঠিক পরের শুধু-নতুন-লাইন সেগমেন্ট: টেক্সট (অফসেট) থাকে, দেখা যায় না।
    if (/^\n+$/.test(text.slice(g.s, g.e)) && info.heads.some((h) => h.e === g.s)) { style.display = "block"; style.height = 0; style.overflow = "hidden"; style.lineHeight = 0; style.fontSize = 0; }
    if (inRefs(g)) { style.fontSize = "0.88em"; style.opacity = 0.9; }
    if (hl) style.background = hl.c || COLORS[0];
    if (hl && themeIdx === 2) style.color = "#1F2D2A";
    if (ul) { style.textDecoration = "underline"; style.textDecorationThickness = "2px"; style.textUnderlineOffset = "3px"; }
    const props = { key: g.s, "data-s": g.s, "data-e": g.e, style };
    if (g.covering.length) props["data-m"] = g.covering.map((m) => m.id).join(",");
    segEls.push(React.createElement("span", props, text.slice(g.s, g.e)));
  });

  const titleBlock = React.createElement(
    "div", { style: { whiteSpace: "normal", marginBottom: "18px", paddingBottom: "14px", borderBottom: "1px solid rgba(128,128,128,0.3)" } },
    React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" } },
      catLabel && React.createElement("span", { style: { fontSize: "12px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", color: accent, border: "1px solid " + accent } }, catLabel),
      rangeLabel && React.createElement("span", { style: { fontSize: "12px", padding: "3px 10px", borderRadius: "999px", border: "1px solid rgba(128,128,128,0.5)" } }, rangeLabel)
    ),
    React.createElement("div", { style: { fontSize: "1.35em", fontWeight: 700, lineHeight: 1.4 } }, post.title)
  );

  const body = React.createElement(
    "div", {
      ref: contentRef, onClick: onContentClick,
      onScroll: (e) => { const el = e.currentTarget; const max = el.scrollHeight - el.clientHeight; setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0); },
      style: { flex: 1, overflowY: "auto", padding: "18px 20px 40px", touchAction: "pan-y", WebkitUserSelect: "text", userSelect: "text", fontFamily: "'WgBnDigits', 'Hind Siliguri', sans-serif", fontSize: font + "px", lineHeight: 1.95, whiteSpace: "pre-wrap", wordBreak: "break-word", color: theme.fg, background: theme.bg },
    },
    React.createElement("div", { style: { maxWidth: "680px", margin: "0 auto" } },
    titleBlock,
    segEls,
    post.sourceNote && React.createElement("div", { style: { whiteSpace: "normal", marginTop: "20px", fontSize: "0.8em", opacity: 0.7 } }, "সোর্স: " + post.sourceNote),
    !validMarks.length && marks.length > 0 && React.createElement("div", { style: { marginTop: "12px", fontSize: "12px", opacity: 0.7 } }, "লেখা বদলে যাওয়ায় পুরনো কিছু মার্ক এখন দেখানো হচ্ছে না।")
    )
  );
  const progressBar = React.createElement(
    "div", { style: { height: "3px", background: "rgba(128,128,128,0.2)" } },
    React.createElement("div", { style: { height: "3px", width: (progress * 100) + "%", background: accent, transition: "width 0.1s linear" } })
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
    progressBar,
    body,
    React.createElement(
      "div", { style: { padding: "8px 10px", background: theme.bar, color: theme.fg, borderTop: "1px solid rgba(128,128,128,0.3)" } },
      err && React.createElement("div", { style: { color: "#C0392B", fontSize: "13px", marginBottom: "4px", textAlign: "center" } }, err),
      tool
    )
  );
}
