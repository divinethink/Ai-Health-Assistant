// Doctor Details & Visiting Card — container।
//
// আপডেট (owner-request, ২০২৬-০৯-১৬): Full-page mode এখন Health ব্লগ
// (WellnessGuideSection.js)-এর মতোই বাম পাশে collapsible specialty-category
// sidebar (mobile-এ hamburger-drawer, desktop-এ permanently-visible)। Category
// অনুযায়ী ডাক্তার-তালিকা filter হয় (DoctorDetailsList.js-এর client-side
// filter, ছোট dataset বলে আলাদা query লাগেনি)। "+ যুক্ত করুন" বাটন header-এই
// থাকছে। কোনো নতুন schema/permission-logic লাগেনি — presentation-layer-only
// redesign + doctorDetailsData.js-এর নতুন fixed ১০-category list + ঐচ্ছিক
// `area` field (এলাকা) UI-তে প্রতিফলিত।
//
// Inline (non-full-page, !onExit) mode আগের সাধারণ stacked-list layout-এই
// অপরিবর্তিত রাখা হয়েছে — বর্তমানে কোনো caller এই mode ব্যবহার করে না
// (app.js সবসময় onExit দেয়), কিন্তু backward-compatible রাখা হলো
// (Process Rule ২, Minimal Change)।

import { DoctorDetailsForm } from "./DoctorDetailsForm.js";
import { DoctorDetailsList } from "./DoctorDetailsList.js";
import { DOCTOR_CATEGORIES } from "./doctorDetailsData.js";

const { useState, useEffect } = React;

function AddDoctorButton({ onClick }) {
  return React.createElement(
    "button", {
      onClick,
      style: { fontSize: "14px", minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "1px solid #0E4B43", background: "linear-gradient(135deg, #0E4B43, #17705F)", color: "#fff", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 3px 8px rgba(14,75,67,0.25)", fontFamily: "inherit" },
    },
    "+ নতুন ডাক্তার যোগ করুন"
  );
}

// Category-sidebar — WellnessGuideSection.js-এর CategorySidebar-এর হুবহু
// visual pattern, কিন্তু cross-feature-folder import এড়াতে (existing app-wide
// convention — pattern কপি করে reuse, cross-import না) এখানে local component।
function DoctorCategorySidebar({ category, onSelect }) {
  const items = [["all", "সব"], ...DOCTOR_CATEGORIES];
  return React.createElement(
    "div", { style: { width: "100%", height: "100%", background: "#EEF5F0", padding: "10px", boxSizing: "border-box", overflowY: "auto" } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: "#0E4B43", padding: "4px 8px", marginBottom: "4px" } }, "বিভাগ"),
    items.map(([catId, label]) => {
      const active = category === catId;
      return React.createElement(
        "div", {
          key: catId, onClick: () => onSelect(catId),
          style: {
            padding: "8px 10px", borderRadius: "10px", fontSize: "14px", cursor: "pointer", marginBottom: "2px",
            background: active ? "#0E4B43" : "transparent", color: active ? "#fff" : "#1F2D2A",
          },
        },
        label
      );
    })
  );
}

export function DoctorDetailsSection({ familyId, callerMemberId, isAdmin, onExit }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [category, setCategory] = useState("all");
  // Desktop-এ ডিফল্টে sidebar খোলা, mobile-এ বন্ধ (WellnessGuideSection.js-এর
  // হুবহু mount-time viewport-check pattern)।
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 900) setSidebarOpen(true);
  }, []);

  function handleSaved() {
    setShowForm(false);
    setEditingDoctor(null);
    setRefreshTick((t) => t + 1);
  }

  function selectCategory(catId) {
    setCategory(catId);
    setSidebarOpen(false); // mobile drawer বন্ধ; desktop-এ চাইলে হ্যামবার্গারে আবার খোলা যাবে
  }

  // ---- Inline (non-full-page) mode — অপরিবর্তিত পুরনো layout, backward-compatible ----
  if (!onExit) {
    return React.createElement(
      "div", { style: { marginTop: "20px" } },
      React.createElement(
        "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
        React.createElement("h3", { style: { fontSize: "16px", fontWeight: 800, color: "#0E4B43", margin: 0 } }, "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"),
        !showForm && !editingDoctor && React.createElement(AddDoctorButton, { onClick: () => { setEditingDoctor(null); setShowForm(true); } })
      ),
      !showForm && !editingDoctor && React.createElement("div", { role: "group", "aria-label": "বিভাগ", style: { display: "flex", gap: "6px", overflowX: "auto", marginTop: "10px", paddingBottom: "2px" } },
        [["all", "সব"], ...DOCTOR_CATEGORIES].map(([catId, label]) => React.createElement("button", {
          key: catId, onClick: () => setCategory(catId), "aria-pressed": category === catId,
          style: { flexShrink: 0, minHeight: "40px", padding: "0 14px", borderRadius: "999px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            border: category === catId ? "1px solid #0E4B43" : "1px solid #C3D2CA", background: category === catId ? "linear-gradient(135deg, #0E4B43, #17705F)" : "#fff", color: category === catId ? "#fff" : "#2B3A36" },
        }, label))),
      (showForm || editingDoctor) && React.createElement(DoctorDetailsForm, {
        familyId, callerMemberId, editingDoctor,
        onSaved: handleSaved,
        onCancel: () => { setShowForm(false); setEditingDoctor(null); },
      }),
      React.createElement(DoctorDetailsList, {
        key: "doctor-list" + refreshTick, familyId, category, refreshTick, callerMemberId, isAdmin,
        onEdit: (d) => { setShowForm(false); setEditingDoctor(d); },
        onDeleted: () => setRefreshTick((t) => t + 1),
      })
    );
  }

  // ---- Full-page mode — নতুন blog-style sidebar layout ----
  const headerBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "#0E4B43", color: "#fff" } },
    React.createElement("button", {
      onClick: () => setSidebarOpen((o) => !o), title: "বিভাগ",
      style: { background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: "14px", padding: "4px 8px", borderRadius: "10px", cursor: "pointer" },
    }, "☰"),
    React.createElement("div", { style: { flex: 1, fontWeight: 700, fontSize: "15px" } }, "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"),
    !showForm && !editingDoctor && React.createElement("button", {
      onClick: () => { setEditingDoctor(null); setShowForm(true); },
      style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid #fff", background: "#fff", color: "#0E4B43", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
    }, "+ যুক্ত করুন")
  );

  const sidebarDrawer = sidebarOpen && React.createElement(
    React.Fragment, null,
    React.createElement("div", { onClick: () => setSidebarOpen(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 20 } }),
    React.createElement(
      "div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "78%", maxWidth: "260px", zIndex: 21, boxShadow: "3px 0 10px rgba(0,0,0,0.25)" } },
      React.createElement(DoctorCategorySidebar, { category, onSelect: selectCategory })
    )
  );

  const mainContent = React.createElement(
    "div", { style: { flex: 1, overflowY: "auto", padding: "12px 14px" } },
    (showForm || editingDoctor) && React.createElement(DoctorDetailsForm, {
      familyId, callerMemberId, editingDoctor,
      onSaved: handleSaved,
      onCancel: () => { setShowForm(false); setEditingDoctor(null); },
    }),
    React.createElement(DoctorDetailsList, {
      key: "doctor-list" + refreshTick, familyId, category, refreshTick, callerMemberId, isAdmin,
      onEdit: (d) => { setShowForm(false); setEditingDoctor(d); },
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#fff", fontFamily: "'Hind Siliguri', sans-serif" } },
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
        style: { background: "none", border: "1px solid #0E4B43", color: "#0E4B43", fontSize: "14px", padding: "5px 12px", borderRadius: "10px", cursor: "pointer" },
      }, "← ফিরে যান")
    )
  );
}
