// Wellness Guide Section — ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা
// (owner-request, ২০২৬-০৯-১২; Admin CRUD upgrade একই দিনে)। Global,
// category-filter-সহ read সবার জন্য; add/edit/delete শুধু Admin
// (firestore.rules-এ isAdminOfFamily(familyId) guard)। কোনো AI/dose/triage
// logic নেই — শুধু owner-curated reference content।

import { ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { listWellnessGuides, deleteWellnessGuide, WELLNESS_CATEGORIES, formatAgeOrMonthRange } from "./wellnessGuideData.js";
import { WellnessGuideForm } from "./WellnessGuideForm.js";

const { useState, useEffect } = React;

function PostCard({ post, expanded, onToggle, isAdmin, onEdit, onDelete }) {
  const rangeLabel = formatAgeOrMonthRange(post);
  return React.createElement(
    "div", { key: post.id, style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px", marginBottom: "8px" } },
    React.createElement(
      "div", { style: { cursor: "pointer" }, onClick: onToggle },
      React.createElement("div", { style: { fontWeight: 600, color: "#0E4B43", fontSize: "14px" } }, post.title),
      React.createElement(
        "div", { style: { fontSize: "11px", color: "#888", marginTop: "2px" } },
        (rangeLabel ? rangeLabel + " · " : "") + (post.tags || []).join(", ")
      ),
      post.summary && React.createElement("div", { style: { fontSize: "12px", color: "#555", marginTop: "6px" } }, post.summary)
    ),
    expanded && React.createElement(
      "div", { style: { fontSize: "13px", color: "#333", marginTop: "10px", whiteSpace: "pre-wrap", borderTop: "1px solid #EEE", paddingTop: "8px" } },
      post.body,
      post.sourceNote && React.createElement("div", { style: { fontSize: "11px", color: "#999", marginTop: "8px" } }, "সোর্স: " + post.sourceNote)
    ),
    isAdmin && React.createElement(
      "div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
      React.createElement(
        "button", {
          onClick: (e) => { e.stopPropagation(); onEdit(post); },
          style: { fontSize: "11px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#fff", cursor: "pointer" },
        },
        "এডিট"
      ),
      React.createElement(
        "button", {
          onClick: (e) => { e.stopPropagation(); onDelete(post); },
          style: { fontSize: "11px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
        },
        "ডিলিট"
      )
    )
  );
}

export function WellnessGuideSection({ familyId, isAdmin }) {
  const [category, setCategory] = useState("all");
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null); // ২-ধাপ confirm (existing app-wide delete pattern)

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

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "🌿 সুস্থ জীবনযাপন নির্দেশিকা"),
      isAdmin && !showForm && React.createElement(
        "button", {
          onClick: () => { setEditingPost(null); setShowForm(true); },
          style: { fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff", cursor: "pointer" },
        },
        "+ নতুন লেখা যোগ করুন"
      )
    ),
    (showForm || editingPost) && React.createElement(WellnessGuideForm, {
      familyId, editingPost,
      onSaved: handleSaved,
      onCancel: () => { setShowForm(false); setEditingPost(null); },
    }),
    React.createElement(
      "div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" } },
      ["all", ...WELLNESS_CATEGORIES.map((c) => c[0])].map((catId) => {
        const label = catId === "all" ? "সব" : WELLNESS_CATEGORIES.find((c) => c[0] === catId)[1];
        const active = category === catId;
        return React.createElement(
          "button", {
            key: catId, onClick: () => { setCategory(catId); setExpandedId(null); },
            style: {
              padding: "5px 10px", borderRadius: "14px", fontSize: "12px", cursor: "pointer",
              border: active ? "1px solid #0E4B43" : "1px solid #CBD5E1",
              background: active ? "#0E4B43" : "#fff", color: active ? "#fff" : "#333",
            },
          },
          label
        );
      })
    ),
    err && ErrorBox(err),
    !err && posts === null && React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে..."),
    !err && posts && posts.length === 0 && React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "এখনো এই ক্যাটেগরিতে কোনো পোস্ট যোগ হয়নি।"),
    !err && posts && posts.map((p) =>
      React.createElement(PostCard, {
        key: p.id, post: p, expanded: expandedId === p.id,
        onToggle: () => setExpandedId((id) => (id === p.id ? null : p.id)),
        isAdmin,
        onEdit: (post) => { setShowForm(false); setEditingPost(post); },
        onDelete: (post) => setPendingDelete(post),
      })
    ),
    pendingDelete && React.createElement(
      "div", { style: { marginTop: "10px", padding: "10px", border: "1px solid #C0392B", borderRadius: "8px", background: "#FDF2F2" } },
      React.createElement("div", { style: { fontSize: "13px", marginBottom: "8px" } }, "\"" + pendingDelete.title + "\" পোস্টটা স্থায়ীভাবে ডিলিট করবেন?"),
      PrimaryButton("হ্যাঁ, ডিলিট করুন", confirmDelete, false),
      SecondaryButton("বাতিল", () => setPendingDelete(null), false)
    )
  );
}
