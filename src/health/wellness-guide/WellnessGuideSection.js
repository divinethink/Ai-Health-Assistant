// Wellness Guide Section — ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা।
//
// আপডেট (owner-request, ২০২৬-১১-১৩):
//  • ব্লগ খুললে আগে ক্যাটেগরি-পেজ (গ্রিড + পোস্ট-সংখ্যা + সার্চ); ক্যাটেগরিতে ক্লিক করলে তালিকা।
//  • ওপরে সর্ব বামে ব্যাক আইকন (তালিকা → ক্যাটেগরি-পেজ → ব্লগ থেকে বের); তালিকায় ব্যাকের পাশে ক্যাটেগরি-আইকন।
//  • লেখা/এডিট/ডিলিট শুধু ব্লগ-অ্যাডমিন (UI লুকানো + firestore.rules-এ আসল নিয়ন্ত্রণ)। এডিট/ট্র্যাশ
//    রিড-মোডের ⋮ মেনুতে; ডিলিট = ট্র্যাশে সরানো (ফেরত আনা যায়), স্থায়ী মোছা শুধু ট্র্যাশ-পেজ থেকে।
// কোনো AI/dose/triage logic নেই — শুধু owner-curated reference content।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
import { ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import {
  listWellnessGuides, deleteWellnessGuide, trashWellnessGuide, restoreWellnessGuide,
  isBlogAdminUid, WELLNESS_CATEGORIES, formatAgeOrMonthRange,
} from "./wellnessGuideData.js";
import { WellnessGuideForm } from "./WellnessGuideForm.js";
import { WellnessReader } from "./WellnessReader.js";

const { useState, useEffect } = React;

const PRIMARY = "var(--hs-primary, #0E4B43)";

const CATEGORY_ICONS = {
  "general": "🩺", "diet-fitness": "🥗", "child-care": "🧒", "women-health": "👩",
  "elderly-care": "🧓", "chronic-disease-prevention": "🫀", "mental-health": "🧠",
  "skin-beauty": "🧴", "sleep-lifestyle": "😴", "first-aid-emergency": "🚑",
  "education-career": "🎓", "money-life-skills": "💰", "digital-safety": "📱",
  "outdoor-community": "🌳",
};

// প্রতি ক্যাটেগরির নিজস্ব নরম রঙ (আইকন-বৃত্ত ও চিপে ব্যবহার)।
const CATEGORY_COLORS = {
  "general": "#2E7D6B", "diet-fitness": "#E08A1E", "child-care": "#2F80C4", "women-health": "#C2488A",
  "elderly-care": "#7A5C3E", "chronic-disease-prevention": "#C0392B", "mental-health": "#7B58C7",
  "skin-beauty": "#D1707A", "sleep-lifestyle": "#3F51B5", "first-aid-emergency": "#D32F2F",
  "education-career": "#1E88A8", "money-life-skills": "#5C8A1E", "digital-safety": "#455A64",
  "outdoor-community": "#2E8B3E",
};
const tint = (c, pct) => "color-mix(in srgb, " + c + " " + pct + "%, transparent)";

function categoryLabel(id) {
  const hit = WELLNESS_CATEGORIES.find(([cid]) => cid === id);
  return hit ? hit[1] : "";
}

// আনুমানিক পড়ার সময় (মিনিট) — [MORE]/রেফারেন্স বাদে, ~১৮০ শব্দ/মিনিট ধরে।
function readMinutes(body) {
  let t = String(body || "").replace(MORE_MARKER, " ");
  const r = t.search(/^▌\s*রেফারেন্স/m);
  if (r !== -1) t = t.slice(0, r);
  const words = t.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
  return Math.max(1, Math.round(words / 180));
}

function toBn(n) {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

// Read-More marker (owner-request, ২০২৬-০৯-১৩) — `[MORE]`-এর আগের অংশ প্রিভিউ, বাকিটা "আরো পড়ুন"-এ।
// পুরনো পোস্টের `summary` fallback হিসেবে অক্ষত (data-loss নেই)।
const MORE_MARKER = "[MORE]";

function splitBodyAtMarker(body) {
  const idx = (body || "").indexOf(MORE_MARKER);
  if (idx === -1) return null;
  return {
    preview: body.slice(0, idx).trim(),
    rest: body.slice(idx + MORE_MARKER.length).trim(),
  };
}

const smallBtn = (extra) => ({ fontSize: "14px", padding: "4px 8px", borderRadius: "10px", border: "1px solid #D3E0D9", background: "#fff", cursor: "pointer", ...extra });

function Chip({ text, color }) {
  return React.createElement("span", {
    style: { fontSize: "12px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px", color: color || PRIMARY, background: tint(color || PRIMARY, 14), whiteSpace: "nowrap" },
  }, text);
}

// কার্ড: শিরোনাম + ২-৩ লাইন সারাংশ + চিপ (ক্যাটেগরি, বয়স, পড়ার সময়)। ক্লিকে সরাসরি পড়ার মোড।
function PostCard({ post, onOpen, trashMode, onRestore, onPurge }) {
  const rangeLabel = formatAgeOrMonthRange(post);
  const split = splitBodyAtMarker(post.body);
  let snippet = (split ? split.preview : post.summary || "")
    .split("\n").filter((l) => l.trim() && l.trim().indexOf("▌") !== 0).join(" ").trim();
  if (!snippet && split) snippet = split.rest.split("\n").filter((l) => l.trim() && l.trim().indexOf("▌") !== 0).join(" ").slice(0, 160);
  const color = CATEGORY_COLORS[post.category] || PRIMARY;

  return React.createElement(
    "div", {
      key: post.id, role: trashMode ? undefined : "button",
      onClick: trashMode ? undefined : () => onOpen(post),
      style: { ...PREMIUM_CARD, padding: "14px", marginBottom: "10px", cursor: trashMode ? "default" : "pointer", borderLeft: "4px solid " + color },
    },
    React.createElement("div", { style: { fontWeight: 700, color: "var(--hs-text, #1B2430)", fontSize: "15px", lineHeight: 1.45 } }, post.title),
    snippet && React.createElement("div", {
      style: { fontSize: "14px", color: "var(--hs-muted, #5F716C)", marginTop: "6px", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" },
    }, snippet),
    React.createElement(
      "div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginTop: "10px" } },
      React.createElement(Chip, { text: categoryLabel(post.category), color }),
      rangeLabel && React.createElement(Chip, { text: rangeLabel, color: "#5F716C" }),
      React.createElement("span", { style: { fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, "⏱ প্রায় " + toBn(readMinutes(post.body)) + " মিনিট"),
      !trashMode && React.createElement("span", { style: { marginLeft: "auto", fontSize: "14px", fontWeight: 700, color: PRIMARY } }, "পড়ুন ›")
    ),
    trashMode && React.createElement(
      "div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" } },
      React.createElement("button", { onClick: () => onRestore(post), style: smallBtn({ border: "1px solid " + PRIMARY, color: PRIMARY, fontWeight: 600 }) }, "↩ ফেরত আনুন"),
      React.createElement("button", { onClick: () => onPurge(post), style: smallBtn({ border: "1px solid #C0392B", color: "#C0392B" }) }, "স্থায়ীভাবে মুছুন")
    )
  );
}

function CategorySidebar({ category, onSelect, counts, total, canManage, trashCount }) {
  const items = [["all", "সকল লেখা", total], ...WELLNESS_CATEGORIES.map(([id, label]) => [id, label, counts[id] || 0])];
  if (canManage) items.push(["trash", "🗑 ট্র্যাশ", trashCount]);
  return React.createElement(
    "div", { style: { width: "100%", height: "100%", background: "#EEF5F0", padding: "10px", boxSizing: "border-box", overflowY: "auto" } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: PRIMARY, padding: "4px 8px", marginBottom: "4px" } }, "ক্যাটেগরি"),
    items.map(([catId, label, n]) => {
      const active = category === catId;
      return React.createElement(
        "div", {
          key: catId, onClick: () => onSelect(catId),
          style: {
            padding: "8px 10px", borderRadius: "10px", fontSize: "14px", cursor: "pointer", marginBottom: "2px",
            background: active ? PRIMARY : "transparent", color: active ? "#fff" : "#1F2D2A",
          },
        },
        label + " (" + toBn(n) + ")"
      );
    })
  );
}

// ক্যাটেগরি-টাইল: ছোট কার্ড, ৩ কলাম। hero = "সকল লেখা" (পুরো প্রস্থ, গোল্ডেন আভা)।
function CategoryTile({ icon, label, count, color, onClick, hero }) {
  const c = color || PRIMARY;
  const text = label + " (" + toBn(count) + ")";
  if (hero) {
    return React.createElement(
      "div", {
        onClick, role: "button",
        style: {
          gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", cursor: "pointer", boxSizing: "border-box",
          borderRadius: "18px", border: "1px solid rgba(212,160,23,0.55)",
          background: "linear-gradient(135deg, rgba(255,236,179,0.55), var(--hs-surface, #fff))",
          boxShadow: "0 0 0 3px rgba(212,160,23,0.14), 0 6px 20px rgba(212,160,23,0.30)",
        },
      },
      React.createElement("div", { style: { width: "40px", height: "40px", borderRadius: "12px", background: "rgba(212,160,23,0.20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 } }, icon),
      React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "var(--hs-text, #1B2430)" } }, text)
    );
  }
  return React.createElement(
    "div", {
      onClick, role: "button",
      style: { ...PREMIUM_CARD, borderRadius: "16px", padding: "10px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "6px", minHeight: "86px", boxSizing: "border-box" },
    },
    React.createElement("div", { style: { width: "34px", height: "34px", borderRadius: "11px", background: tint(c, 16), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", flexShrink: 0 } }, icon),
    React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "var(--hs-text, #1B2430)", lineHeight: 1.35 } }, text)
  );
}

export function WellnessGuideSection({ familyId, myMemberId, onExit }) {
  // category: null = ক্যাটেগরি-পেজ; "all" | ক্যাটেগরি-id | "trash" = তালিকা
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [readerPost, setReaderPost] = useState(null);
  const [pendingTrash, setPendingTrash] = useState(null);
  const [pendingPurge, setPendingPurge] = useState(null); // ২-ধাপ confirm (existing app-wide delete pattern)
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const authUser = typeof firebase !== "undefined" && firebase.auth ? firebase.auth().currentUser : null;
  const readerUid = authUser ? authUser.uid : null;
  const canManage = isBlogAdminUid(readerUid);

  // সব পোস্ট একবারে লোড; ক্যাটেগরি-ফিল্টার ও সংখ্যা ক্লায়েন্টে (আলাদা read লাগে না)।
  useEffect(() => {
    listWellnessGuides(null)
      .then((list) => { setPosts(list); setErr(null); })
      .catch((e) => setErr(e.message || String(e)));
  }, [refreshTick]);

  const all = posts || [];
  const active = all.filter((p) => !p.deletedAt);
  const trashed = all.filter((p) => p.deletedAt);
  const counts = {};
  active.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });

  const q = query.trim().toLowerCase();
  const searchHits = q
    ? active.filter((p) => ((p.title || "") + " " + (p.summary || "") + " " + (p.tags || []).join(" ")).toLowerCase().indexOf(q) !== -1)
    : null;

  let listPosts = null;
  if (category === "trash") listPosts = trashed;
  else if (category === "all") listPosts = active;
  else if (category) listPosts = active.filter((p) => p.category === category);

  function reload() { setRefreshTick((t) => t + 1); }

  function handleSaved() {
    setShowForm(false);
    setEditingPost(null);
    reload();
  }

  async function confirmTrash() {
    if (!pendingTrash) return;
    try {
      await trashWellnessGuide(pendingTrash.id, readerUid);
      setPendingTrash(null);
      reload();
    } catch (e) {
      setErr(e.message || String(e));
      setPendingTrash(null);
    }
  }

  async function restore(post) {
    try {
      await restoreWellnessGuide(post.id);
      reload();
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  async function confirmPurge() {
    if (!pendingPurge) return;
    try {
      await deleteWellnessGuide(pendingPurge.id);
      setPendingPurge(null);
      reload();
    } catch (e) {
      setErr(e.message || String(e));
      setPendingPurge(null);
    }
  }

  function openCategory(catId) {
    setCategory(catId);
    setSidebarOpen(false);
    setQuery("");
  }

  function goBack() {
    if (showForm || editingPost) { setShowForm(false); setEditingPost(null); return; }
    if (category !== null) { setCategory(null); setSidebarOpen(false); return; }
    if (onExit) onExit();
  }

  const inList = category !== null;
  let title = "🌿 স্বাস্থ্য ব্লগ";
  if (category === "all") title = "সকল লেখা";
  else if (category === "trash") title = "🗑 ট্র্যাশ";
  else if (category) {
    const hit = WELLNESS_CATEGORIES.find(([id]) => id === category);
    title = hit ? hit[1] : title;
  }

  const hdrBtn = { background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: "18px", minWidth: "40px", minHeight: "40px", borderRadius: "10px", cursor: "pointer", flexShrink: 0 };

  const headerBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: "linear-gradient(135deg, var(--hs-hero-1, #0E4B43), var(--hs-hero-2, #17705F))", color: "#fff", boxShadow: "0 2px 10px rgba(14,75,67,0.25)" } },
    React.createElement("button", { type: "button", onClick: goBack, "aria-label": "পিছনে", style: hdrBtn }, "←"),
    inList && !showForm && !editingPost && React.createElement("button", {
      type: "button", onClick: () => setSidebarOpen((o) => !o), "aria-label": "ক্যাটেগরি", title: "ক্যাটেগরি", style: hdrBtn,
    }, "☰"),
    React.createElement("div", { style: { flex: 1, fontWeight: 700, fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
    canManage && !showForm && !editingPost && category !== "trash" && React.createElement(
      "button", {
        onClick: () => { setEditingPost(null); setShowForm(true); },
        style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid #fff", background: "#fff", color: PRIMARY, cursor: "pointer", fontWeight: 600, flexShrink: 0 },
      },
      "+ নতুন লেখা"
    )
  );

  const sidebarDrawer = inList && sidebarOpen && React.createElement(
    React.Fragment, null,
    React.createElement("div", { onClick: () => setSidebarOpen(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 20 } }),
    React.createElement(
      "div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "78%", maxWidth: "260px", zIndex: 21, boxShadow: "3px 0 10px rgba(0,0,0,0.25)" } },
      React.createElement(CategorySidebar, { category, onSelect: openCategory, counts, total: active.length, canManage, trashCount: trashed.length })
    )
  );

  function renderCards(list, trashMode) {
    return list.map((p) =>
      React.createElement(PostCard, {
        key: p.id, post: p, trashMode,
        onOpen: (post) => { if (readerUid) setReaderPost(post); },
        onRestore: restore,
        onPurge: (post) => setPendingPurge(post),
      })
    );
  }

  const searchBox = React.createElement("input", {
    type: "search", value: query, placeholder: "🔍 পোস্ট খুঁজুন (শিরোনাম বা ট্যাগ)",
    onChange: (e) => setQuery(e.target.value),
    style: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "12px", border: "1px solid var(--hs-input-border, #C3D2CA)", background: "var(--hs-surface, #fff)", fontSize: "14px", marginBottom: "12px", fontFamily: "inherit" },
  });

  let body = null;
  if (!err && posts === null) {
    body = React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");
  } else if (!err && category === null) {
    // ক্যাটেগরি-পেজ
    if (searchHits) {
      body = React.createElement(
        React.Fragment, null, searchBox,
        searchHits.length === 0
          ? React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "কিছু পাওয়া যায়নি।")
          : renderCards(searchHits, false)
      );
    } else {
      const tiles = [React.createElement(CategoryTile, { key: "all", icon: "📚", label: "সকল লেখা", count: active.length, color: "#0E4B43", hero: true, onClick: () => openCategory("all") })]
        .concat(WELLNESS_CATEGORIES.map(([id, label]) =>
          React.createElement(CategoryTile, { key: id, icon: CATEGORY_ICONS[id] || "📄", label, color: CATEGORY_COLORS[id], count: counts[id] || 0, onClick: () => openCategory(id) })
        ));
      if (canManage) tiles.push(React.createElement(CategoryTile, { key: "trash", icon: "🗑", label: "ট্র্যাশ", color: "#C0392B", count: trashed.length, onClick: () => openCategory("trash") }));
      body = React.createElement(
        React.Fragment, null, searchBox,
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" } }, tiles)
      );
    }
  } else if (!err && listPosts) {
    body = listPosts.length === 0
      ? React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, category === "trash" ? "ট্র্যাশ খালি।" : "এখনো এই ক্যাটেগরিতে কোনো পোস্ট যোগ হয়নি।")
      : renderCards(listPosts, category === "trash");
  }

  const confirmBox = (text, onYes, yesLabel, onNo) => React.createElement(
    "div", { style: { marginBottom: "10px", padding: "10px", border: "1px solid #C0392B", borderRadius: "14px", background: "#FDF2F2" } },
    React.createElement("div", { style: { fontSize: "14px", marginBottom: "8px" } }, text),
    PrimaryButton(yesLabel, onYes, false),
    SecondaryButton("বাতিল", onNo, false)
  );

  const mainContent = React.createElement(
    "div", { style: { flex: 1, overflowY: "auto", padding: "14px" } },
    pendingTrash && confirmBox("\"" + pendingTrash.title + "\" পোস্টটা ট্র্যাশে পাঠাবেন? (পরে ফেরত আনা যাবে)", confirmTrash, "হ্যাঁ, ট্র্যাশে পাঠান", () => setPendingTrash(null)),
    pendingPurge && confirmBox("\"" + pendingPurge.title + "\" পোস্টটা স্থায়ীভাবে মুছবেন? এটি আর ফেরত আসবে না।", confirmPurge, "হ্যাঁ, স্থায়ীভাবে মুছুন", () => setPendingPurge(null)),
    canManage && (showForm || editingPost) && React.createElement(WellnessGuideForm, {
      familyId, myMemberId, editingPost,
      onSaved: handleSaved,
      onCancel: () => { setShowForm(false); setEditingPost(null); },
    }),
    err && ErrorBox(err),
    body
  );

  if (readerPost && readerUid) {
    return React.createElement(WellnessReader, {
      post: readerPost, uid: readerUid, onClose: () => setReaderPost(null),
      canManage,
      onEdit: (post) => { setReaderPost(null); setShowForm(false); setEditingPost(post); },
      onTrash: (post) => { setReaderPost(null); setPendingTrash(post); },
    });
  }

  return React.createElement(
    "div", { style: { position: "fixed", top: 0, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "var(--hs-bg, #F1F6F2)", fontFamily: "'Hind Siliguri', sans-serif" } },
    headerBar,
    React.createElement(
      "div", { style: { flex: 1, display: "flex", minHeight: 0, position: "relative" } },
      sidebarDrawer,
      mainContent
    )
  );
}
