// Wellness Guide Section — ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা
// (owner-request, ২০২৬-০৯-১২)। Global, read-only, category-filter-সহ।
// কোনো AI/dose/triage-logic নেই — শুধু owner-curated reference content
// (§12.4/§5.2-এর মতোই "static reference" pattern, কিন্তু blog-style)।

import { ErrorBox } from "../../shared/ui.js";
import { listWellnessGuides, WELLNESS_CATEGORIES, formatAgeOrMonthRange } from "./wellnessGuideData.js";

const { useState, useEffect } = React;

function PostCard({ post, expanded, onToggle }) {
  const rangeLabel = formatAgeOrMonthRange(post);
  return React.createElement(
    "div", { key: post.id, style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px", marginBottom: "8px", cursor: "pointer" }, onClick: onToggle },
    React.createElement("div", { style: { fontWeight: 600, color: "#0E4B43", fontSize: "14px" } }, post.title),
    React.createElement(
      "div", { style: { fontSize: "11px", color: "#888", marginTop: "2px" } },
      (rangeLabel ? rangeLabel + " · " : "") + (post.tags || []).join(", ")
    ),
    post.summary && React.createElement("div", { style: { fontSize: "12px", color: "#555", marginTop: "6px" } }, post.summary),
    expanded && React.createElement(
      "div", { style: { fontSize: "13px", color: "#333", marginTop: "10px", whiteSpace: "pre-wrap", borderTop: "1px solid #EEE", paddingTop: "8px" } },
      post.body
    )
  );
}

export function WellnessGuideSection() {
  const [category, setCategory] = useState("all");
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setPosts(null);
    listWellnessGuides(category === "all" ? null : category)
      .then(setPosts)
      .catch((e) => setErr(e.message || String(e)));
  }, [category]);

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "🌿 সুস্থ জীবনযাপন নির্দেশিকা"),
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
      })
    )
  );
}
