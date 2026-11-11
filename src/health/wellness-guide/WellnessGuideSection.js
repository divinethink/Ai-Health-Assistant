// Wellness Guide Section — ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা।
//
// আপডেট (owner-request, ২০২৬-০৯-১৩): এখন একটা full-screen
// special-mode — normal বাটনে ক্লিক করলে খোলে (app.js-এ showHealthBlog toggle),
// ভেতরে category-sidebar (mobile-এ drawer) + পোস্ট-লিস্ট। ডেটা-লেয়ার (wellnessGuideData.js) ও
// PostCard/WellnessGuideForm অপরিবর্তিত — শুধু layout/wrapper নতুন।
// কোনো AI/dose/triage logic নেই — শুধু owner-curated reference content।

import { ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { listWellnessGuides, deleteWellnessGuide, WELLNESS_CATEGORIES, formatAgeOrMonthRange } from "./wellnessGuideData.js";
import { WellnessGuideForm } from "./WellnessGuideForm.js";

const { useState, useEffect } = React;

// Read-More marker (owner-request, ২০২৬-০৯-১৩) — WordPress-এর "Insert More
// Tag"-এর মতো: লেখক body-টেক্সটের যেখানে `[MORE]` বসাবেন, প্রিভিউ ঠিক সেই
// বিন্দু পর্যন্ত দেখাবে, বাকিটা "আরো পড়ুন"-এ ক্লিকে খুলবে। আগের আলাদা
// "সংক্ষিপ্ত সারাংশ" ফিল্ড আর ব্যবহার হচ্ছে না (নতুন পোস্টে ফর্ম থেকেই বাদ) —
// কিন্তু পুরনো পোস্টে থাকা `summary` ডেটা fallback হিসেবে অক্ষত থাকল (data-loss
// নেই, Process Rule ৩)।
const MORE_MARKER = "[MORE]";

function splitBodyAtMarker(body) {
  const idx = (body || "").indexOf(MORE_MARKER);
  if (idx === -1) return null;
  return {
    preview: body.slice(0, idx).trim(),
    rest: body.slice(idx + MORE_MARKER.length).trim(),
  };
}

function PostCard({ post, expanded, onToggle, canEdit, canDelete, onEdit, onDelete }) {
  const rangeLabel = formatAgeOrMonthRange(post);
  const split = splitBodyAtMarker(post.body);
  // marker থাকলে preview = marker-এর আগের অংশ; না থাকলে পুরনো summary
  // fallback (থাকলে); কোনোটাই না থাকলে preview নেই — শুধু ক্লিক করলে খুলবে।
  const previewText = split ? split.preview : post.summary || null;
  const remainingText = split ? split.rest : post.body;
  const hasMore = !!split || !!post.summary;

  return React.createElement(
    "div", { key: post.id, style: { border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", padding: "10px", marginBottom: "8px" } },
    React.createElement(
      "div", { style: { cursor: "pointer" }, onClick: onToggle },
      React.createElement("div", { style: { fontWeight: 600, color: "var(--hs-primary, #0E4B43)", fontSize: "14px" } }, post.title),
      React.createElement(
        "div", { style: { fontSize: "14px", color: "#5F716C", marginTop: "2px" } },
        (rangeLabel ? rangeLabel + " · " : "") + (post.tags || []).join(", ")
      ),
      previewText && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "6px", whiteSpace: "pre-wrap" } }, previewText),
      !expanded && hasMore && React.createElement(
        "span", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", fontWeight: 600, marginTop: "4px", display: "inline-block" } },
        "আরো পড়ুন »"
      )
    ),
    expanded && React.createElement(
      "div", { style: { fontSize: "14px", color: "#1F2D2A", marginTop: "10px", whiteSpace: "pre-wrap", borderTop: "1px solid #D3E0D9", paddingTop: "8px" } },
      remainingText,
      post.sourceNote && React.createElement("div", { style: { fontSize: "14px", color: "#6B7B76", marginTop: "8px" } }, "সোর্স: " + post.sourceNote)
    ),
    (canEdit || canDelete) && React.createElement(
      "div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
      canEdit && React.createElement(
        "button", {
          onClick: (e) => { e.stopPropagation(); onEdit(post); },
          style: { fontSize: "14px", padding: "4px 8px", borderRadius: "10px", border: "1px solid #D3E0D9", background: "#fff", cursor: "pointer" },
        },
        "এডিট"
      ),
      canDelete && React.createElement(
        "button", {
          onClick: (e) => { e.stopPropagation(); onDelete(post); },
          style: { fontSize: "14px", padding: "4px 8px", borderRadius: "10px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
        },
        "ডিলিট"
      )
    )
  );
}

function CategorySidebar({ category, onSelect }) {
  const items = [["all", "সব"], ...WELLNESS_CATEGORIES];
  return React.createElement(
    "div", { style: { width: "100%", height: "100%", background: "#EEF5F0", padding: "10px", boxSizing: "border-box", overflowY: "auto" } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: "var(--hs-primary, #0E4B43)", padding: "4px 8px", marginBottom: "4px" } }, "ক্যাটেগরি"),
    items.map(([catId, label]) => {
      const active = category === catId;
      return React.createElement(
        "div", {
          key: catId, onClick: () => onSelect(catId),
          style: {
            padding: "8px 10px", borderRadius: "10px", fontSize: "14px", cursor: "pointer", marginBottom: "2px",
            background: active ? "var(--hs-primary, #0E4B43)" : "transparent", color: active ? "#fff" : "#1F2D2A",
          },
        },
        label
      );
    })
  );
}

export function WellnessGuideSection({ familyId, isAdmin, myMemberId, onExit }) {
  const [category, setCategory] = useState("all");
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null); // ২-ধাপ confirm (existing app-wide delete pattern)
  // Desktop-এ ডিফল্টে sidebar খোলা, mobile-এ বন্ধ (mount-time viewport-check)।
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 900) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    setPosts(null);
    listWellnessGuides(category === "all" ? null : category)
      .then(setPosts)
      .catch((e) => setErr(e.message || String(e)));
  }, [category, refreshTick]);

  function handleSaved() {
    setShowForm(false);
    setEditingPost(null);
    setRefreshTick((t) => t + 1);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteWellnessGuide(pendingDelete.id);
      setPendingDelete(null);
      setRefreshTick((t) => t + 1);
    } catch (e) {
      setErr(e.message || String(e));
      setPendingDelete(null);
    }
  }

  function selectCategory(catId) {
    setCategory(catId);
    setExpandedId(null);
    setSidebarOpen(false); // mobile drawer বন্ধ; desktop-এ user চাইলে হ্যামবার্গারে আবার খুলবেন
  }

  const headerBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--hs-primary, #0E4B43)", color: "#fff" } },
    React.createElement("button", {
      onClick: () => setSidebarOpen((o) => !o), title: "ক্যাটেগরি",
      style: { background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: "14px", padding: "4px 8px", borderRadius: "10px", cursor: "pointer" },
    }, "☰"),
    React.createElement("div", { style: { flex: 1, fontWeight: 700, fontSize: "15px" } }, "🌿 স্বাস্থ্য ব্লগ"),
    !showForm && !editingPost && React.createElement(
      "button", {
        onClick: () => { setEditingPost(null); setShowForm(true); },
        style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid #fff", background: "#fff", color: "var(--hs-primary, #0E4B43)", cursor: "pointer", fontWeight: 600 },
      },
      "+ নতুন লেখা"
    ),
    onExit && React.createElement("button", { type: "button", onClick: onExit, "aria-label": "বন্ধ করুন", style: { flexShrink: 0, minWidth: "44px", minHeight: "44px", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "12px", background: "none", color: "#fff", fontSize: "20px", fontWeight: 700, cursor: "pointer" } }, "✕")
  );

  const sidebarDrawer = sidebarOpen && React.createElement(
    React.Fragment, null,
    React.createElement("div", { onClick: () => setSidebarOpen(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 20 } }),
    React.createElement(
      "div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "78%", maxWidth: "260px", zIndex: 21, boxShadow: "3px 0 10px rgba(0,0,0,0.25)" } },
      React.createElement(CategorySidebar, { category, onSelect: selectCategory })
    )
  );

  const mainContent = React.createElement(
    "div", { style: { flex: 1, overflowY: "auto", padding: "12px 14px" } },
    (showForm || editingPost) && React.createElement(WellnessGuideForm, {
      familyId, myMemberId, editingPost,
      onSaved: handleSaved,
      onCancel: () => { setShowForm(false); setEditingPost(null); },
    }),
    err && ErrorBox(err),
    !err && posts === null && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে..."),
    !err && posts && posts.length === 0 && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "এখনো এই ক্যাটেগরিতে কোনো পোস্ট যোগ হয়নি।"),
    !err && posts && posts.map((p) =>
      React.createElement(PostCard, {
        key: p.id, post: p, expanded: expandedId === p.id,
        onToggle: () => setExpandedId((id) => (id === p.id ? null : p.id)),
        canEdit: !!myMemberId && p.authorId === myMemberId,
        canDelete: isAdmin || (!!myMemberId && p.authorId === myMemberId),
        onEdit: (post) => { setShowForm(false); setEditingPost(post); },
        onDelete: (post) => setPendingDelete(post),
      })
    ),
    pendingDelete && React.createElement(
      "div", { style: { marginTop: "10px", padding: "10px", border: "1px solid #C0392B", borderRadius: "14px", background: "#FDF2F2" } },
      React.createElement("div", { style: { fontSize: "14px", marginBottom: "8px" } }, "\"" + pendingDelete.title + "\" পোস্টটা স্থায়ীভাবে ডিলিট করবেন?"),
      PrimaryButton("হ্যাঁ, ডিলিট করুন", confirmDelete, false),
      SecondaryButton("বাতিল", () => setPendingDelete(null), false)
    )
  );

  return React.createElement(
    "div", { style: { position: "fixed", top: 0, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#fff", fontFamily: "'Hind Siliguri', sans-serif" } },
    headerBar,
    React.createElement(
      "div", { style: { flex: 1, display: "flex", minHeight: 0, position: "relative" } },
      sidebarDrawer,
      mainContent
    ),
    React.createElement(
      "div", { style: { padding: "8px 14px", background: "#EEF5F0", borderTop: "1px solid #D3E0D9", textAlign: "right" } },
      React.createElement("button", {
        onClick: onExit,
        style: { background: "none", border: "1px solid var(--hs-primary, #0E4B43)", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", padding: "5px 12px", borderRadius: "10px", cursor: "pointer" },
      }, "← ফিরে যান")
    )
  );
}
