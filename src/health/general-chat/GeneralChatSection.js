// General Chat — Admin-only special mode (নতুন, এই থ্রেড)।
//
// বাকি অ্যাপ থেকে ইচ্ছাকৃতভাবে ভিন্ন visual-identity (dark sidebar + full-screen
// takeover) — যাতে ভুলবশত এটাকে health-guidance মনে না হয়। app.js থেকে
// Dashboard-এর বদলে পুরো এই component render হয় (isAdmin + toggle-state)।
//
// মূল নীতি এই ফাইলে বাস্তবায়িত:
//  - কোনো health-triage/dose-restriction নেই (Worker `/general-chat`, আলাদা
//    system-prompt) — যেকোনো বিষয়ে (মেডিকেল সাধারণ-জ্ঞানসহ) খোলা আলোচনা।
//  - ডিফল্টে history সেভ হয় না — শুধু per-message "💾 সেভ করুন" বাটনে
//    `generalChatNotes`-এ (Admin-only) সংরক্ষণ হয়।
//  - একাধিক parallel চ্যাট-ট্যাব (client-side, ephemeral)।
//  - ছবি — সরাসরি Cloudinary-তে ephemeral upload (কোনো Firestore metadata
//    doc ছাড়াই), সেভ না করলে ট্যাব/সেশন ছাড়ার সময় best-effort cleanup।
//  - Web-browse — Groq `groq/compound` (built-in web_search+visit_website)।

import { ErrorBox } from "../../shared/ui.js";
import { GeneralChatQuickLinks } from "./GeneralChatQuickLinks.js";
import { askGeneralChat } from "./generalChatClient.js";
import {
  uploadGeneralChatImage, deleteGeneralChatImage, validateGeneralChatImage,
  saveGeneralChatNote, listGeneralChatNotes, deleteGeneralChatNote,
  CATEGORY_LABELS, CATEGORY_ORDER,
} from "./generalChatData.js";

const { useState, useEffect, useRef, useCallback } = React;

let sessionSeq = 1;
function newSession() {
  return { id: "s" + sessionSeq++, title: "নতুন চ্যাট", messages: [] };
}
let msgSeq = 1;
function nextMsgId() { return "m" + msgSeq++; }

export function GeneralChatSection({ familyId, onExit }) {
  const [sessions, setSessions] = useState([newSession()]);
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [activeCategory, setActiveCategory] = useState("misc");
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null); // {secureUrl, publicId, resourceType, uploading}
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [retryNote, setRetryNote] = useState(null);
  const [err, setErr] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(null);
  const [notesErr, setNotesErr] = useState(null);
  const fileInputRef = useRef(null);
  const cleanupMapRef = useRef(new Map()); // messageId -> {publicId, resourceType} — সেভ না হলে unmount-এ মুছবে

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // পেজ বন্ধ/রিফ্রেশ করার আগে সতর্কতা — কোনো session-এ অন্তত ১টা message থাকলে
  useEffect(() => {
    const hasAnyMessage = sessions.some((s) => s.messages.length > 0);
    function handler(e) {
      if (hasAnyMessage) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sessions]);

  // component unmount ("ফিরে যান") হলে সেভ-না-করা ছবি Cloudinary থেকে best-effort মুছে ফেলা
  useEffect(() => {
    return () => {
      for (const { publicId, resourceType } of cleanupMapRef.current.values()) {
        deleteGeneralChatImage(familyId, publicId, resourceType);
      }
      cleanupMapRef.current.clear();
    };
  }, [familyId]);

  function updateSession(id, updater) {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }

  function addNewTab() {
    const s = newSession();
    setSessions((prev) => [...prev, s]);
    setActiveSessionId(s.id);
  }

  function closeTab(id) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length ? next : [newSession()];
    });
    setActiveSessionId((prev) => (prev === id ? null : prev));
  }
  useEffect(() => {
    if (!sessions.find((s) => s.id === activeSessionId)) setActiveSessionId(sessions[0].id);
  }, [sessions, activeSessionId]);

  const onFileChange = useCallback(async (e) => {
    const f = e.target.files && e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!f) return;
    const v = validateGeneralChatImage(f);
    if (v) { setErr(v); return; }
    setErr(null);
    setPendingImage({ uploading: true });
    try {
      const result = await uploadGeneralChatImage(familyId, f);
      setPendingImage({ ...result, uploading: false });
    } catch (e2) {
      setErr(e2.message || String(e2));
      setPendingImage(null);
    }
  }, [familyId]);

  function removePendingImage() {
    if (pendingImage && pendingImage.publicId) {
      deleteGeneralChatImage(familyId, pendingImage.publicId, pendingImage.resourceType);
    }
    setPendingImage(null);
  }

  // sessions[].messages কে Worker-এর জন্য OpenAI-style {role, content} array-এ রূপান্তর
  function buildPayloadMessages(msgs) {
    return msgs.map((m) => {
      if (m.role === "user" && m.imageUrl) {
        const content = [];
        if (m.text) content.push({ type: "text", text: m.text });
        content.push({ type: "image_url", image_url: { url: m.imageUrl } });
        return { role: "user", content };
      }
      return { role: m.role, content: m.text || "" };
    });
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    if (pendingImage && pendingImage.uploading) return;

    const userMsg = {
      id: nextMsgId(), role: "user", text: trimmed,
      imageUrl: pendingImage ? pendingImage.secureUrl : null,
      imagePublicId: pendingImage ? pendingImage.publicId : null,
      imageResourceType: pendingImage ? pendingImage.resourceType : null,
      tag: activeCategory,
    };
    if (userMsg.imagePublicId) cleanupMapRef.current.set(userMsg.id, { publicId: userMsg.imagePublicId, resourceType: userMsg.imageResourceType });

    const sessionForSend = activeSession;
    const newHistory = [...sessionForSend.messages, userMsg];
    const autoTitle = sessionForSend.title === "নতুন চ্যাট" && trimmed ? trimmed.slice(0, 24) : sessionForSend.title;
    updateSession(sessionForSend.id, (s) => ({ ...s, title: autoTitle, messages: newHistory }));

    setText("");
    setPendingImage(null);
    setLoading(true);
    setErr(null);
    setRetryNote(null);

    try {
      const hasImages = !!userMsg.imageUrl;
      const data = await askGeneralChat(familyId, buildPayloadMessages(newHistory), {
        useWebSearch: hasImages ? false : useWebSearch,
        hasImages,
        onRetry: (a, m) => setRetryNote(`একটু অপেক্ষা করুন... (retry ${a}/${m})`),
      });
      const aiMsg = { id: nextMsgId(), role: "assistant", text: data && data.content, tag: activeCategory };
      updateSession(sessionForSend.id, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
    } catch (e) {
      const msg = e.message || String(e);
      setErr(msg.includes("admin-only") ? "শুধু Admin General Chat ব্যবহার করতে পারবেন।" : msg);
    } finally {
      setLoading(false);
      setRetryNote(null);
    }
  }

  async function handleSaveMessage(msg) {
    try {
      await saveGeneralChatNote(familyId, {
        role: msg.role, content: msg.text, tag: msg.tag || activeCategory,
        sessionTitle: activeSession.title,
        attachmentUrl: msg.imageUrl || null,
      });
      if (msg.imagePublicId) cleanupMapRef.current.delete(msg.id); // সেভ হলে আর cleanup-এ মুছবে না
      updateSession(activeSession.id, (s) => ({
        ...s, messages: s.messages.map((m) => (m.id === msg.id ? { ...m, saved: true } : m)),
      }));
    } catch (e) {
      setErr("সেভ করা যায়নি: " + (e.message || String(e)));
    }
  }

  function handleCopy(text2) {
    if (navigator.clipboard) navigator.clipboard.writeText(text2 || "");
  }

  function openNotes() {
    setShowNotes(true);
    setNotesErr(null);
    listGeneralChatNotes(familyId).then(setNotes).catch((e) => setNotesErr(e.message || String(e)));
  }

  async function handleDeleteNote(id) {
    try {
      await deleteGeneralChatNote(familyId, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setNotesErr(e.message || String(e));
    }
  }

  const headerBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#12181F", color: "#fff" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
      React.createElement("button", { onClick: onExit, style: { background: "none", border: "none", color: "#A9C4DE", fontSize: "14px", cursor: "pointer" } }, "← ফিরে যান"),
      React.createElement("span", { style: { fontSize: "15px", fontWeight: 700 } }, "🌐 General Chat"),
      React.createElement("span", { style: { fontSize: "11px", color: "#8FA0B3", border: "1px solid #3A4756", borderRadius: "4px", padding: "1px 6px" } }, "Admin")
    ),
    React.createElement(
      "button", { onClick: openNotes, style: { background: "#22303F", border: "1px solid #3A4756", color: "#D6DEE6", fontSize: "12px", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" } },
      "📁 সেভ করা নোট"
    )
  );

  const tabsBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 16px", background: "#1B2430", overflowX: "auto" } },
    sessions.map((s) =>
      React.createElement(
        "div", {
          key: s.id, onClick: () => setActiveSessionId(s.id),
          style: { display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap", background: s.id === activeSessionId ? "#2A3F52" : "transparent", color: s.id === activeSessionId ? "#fff" : "#8FA0B3" } },
        s.title,
        sessions.length > 1 && React.createElement("span", { onClick: (e) => { e.stopPropagation(); closeTab(s.id); }, style: { color: "#6B7A8C" } }, "✕")
      )
    ),
    React.createElement("button", { onClick: addNewTab, style: { background: "none", border: "1px dashed #3A4756", color: "#8FA0B3", fontSize: "12px", padding: "5px 10px", borderRadius: "6px", cursor: "pointer" } }, "+ নতুন চ্যাট")
  );

  const messagesArea = React.createElement(
    "div", { style: { flex: 1, overflowY: "auto", padding: "16px", background: "#F5F7F9" } },
    activeSession.messages.length === 0 && React.createElement(
      "div", { style: { color: "#8A97A5", fontSize: "13px", textAlign: "center", marginTop: "40px" } },
      "যেকোনো বিষয়ে প্রশ্ন করুন — কৃষি/নার্সারি, ধর্মীয়, রাজনীতি, অর্থনীতি, ইতিহাস, ভূতত্ত্ব, গবেষণা, সাধারণ চিকিৎসা-জ্ঞান — সব খোলা। এটি স্বাস্থ্য-পরামর্শের জন্য নয়; ব্যক্তিগত উপসর্গের ক্ষেত্রে মূল Symptom Check ব্যবহার করুন।"
    ),
    activeSession.messages.map((m) =>
      React.createElement(
        "div", { key: m.id, style: { display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: "10px" } },
        React.createElement(
          "div", { style: { maxWidth: "72%", background: m.role === "user" ? "#0E4B43" : "#fff", color: m.role === "user" ? "#fff" : "#222", border: m.role === "user" ? "none" : "1px solid #E0E4E2", borderRadius: "10px", padding: "10px 12px" } },
          m.imageUrl && React.createElement("img", { src: m.imageUrl, style: { maxWidth: "220px", borderRadius: "6px", display: "block", marginBottom: m.text ? "6px" : 0 } }),
          m.text && React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap", lineHeight: "1.5" } }, m.text),
          React.createElement(
            "div", { style: { marginTop: "6px", display: "flex", gap: "10px" } },
            React.createElement("span", { onClick: () => handleCopy(m.text), style: { fontSize: "11px", cursor: "pointer", color: m.role === "user" ? "#CFE7E1" : "#888" } }, "📋 কপি"),
            !m.saved
              ? React.createElement("span", { onClick: () => handleSaveMessage(m), style: { fontSize: "11px", cursor: "pointer", color: m.role === "user" ? "#CFE7E1" : "#888" } }, "💾 সেভ করুন")
              : React.createElement("span", { style: { fontSize: "11px", color: m.role === "user" ? "#CFE7E1" : "#2E8B57" } }, "✅ সেভ হয়েছে")
          )
        )
      )
    ),
    err && ErrorBox(err),
    retryNote && React.createElement("div", { style: { fontSize: "11px", color: "#7A5B00" } }, retryNote)
  );

  const composer = React.createElement(
    "div", { style: { padding: "10px 16px", background: "#fff", borderTop: "1px solid #E0E4E2" } },
    pendingImage && React.createElement(
      "div", { style: { marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" } },
      pendingImage.uploading
        ? React.createElement("span", { style: { fontSize: "12px", color: "#888" } }, "ছবি আপলোড হচ্ছে...")
        : React.createElement(React.Fragment, null,
            React.createElement("img", { src: pendingImage.secureUrl, style: { width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" } }),
            React.createElement("span", { onClick: removePendingImage, style: { cursor: "pointer", fontSize: "12px", color: "#C0392B" } }, "✕ বাদ দিন")
          )
    ),
    React.createElement(
      "label", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#666", marginBottom: "6px" } },
      React.createElement("input", { type: "checkbox", checked: useWebSearch, disabled: !!pendingImage, onChange: (e) => setUseWebSearch(e.target.checked) }),
      "🌐 প্রয়োজনে ওয়েব থেকে সর্বশেষ তথ্য আনুন",
      pendingImage && React.createElement("span", { style: { color: "#999" } }, "(ছবি-সহ প্রশ্নে ওয়েব-সার্চ প্রযোজ্য না)")
    ),
    React.createElement(
      "div", { style: { display: "flex", gap: "8px", alignItems: "flex-end" } },
      React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: onFileChange, style: { display: "none" } }),
      React.createElement("button", { onClick: () => fileInputRef.current && fileInputRef.current.click(), title: "ছবি যোগ করুন", style: { border: "1px solid #CBD5E1", background: "#fff", borderRadius: "8px", padding: "10px 12px", cursor: "pointer" } }, "📎"),
      React.createElement("textarea", {
        value: text, onChange: (e) => setText(e.target.value), placeholder: "যেকোনো বিষয়ে লিখুন...", rows: 1,
        onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } },
        style: { flex: 1, resize: "none", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit" },
      }),
      React.createElement("button", {
        onClick: handleSend, disabled: loading,
        style: { border: "none", background: loading ? "#8FAFA9" : "#0E4B43", color: "#fff", borderRadius: "8px", padding: "10px 16px", cursor: loading ? "default" : "pointer", fontWeight: 600 },
      }, loading ? "..." : "➤")
    )
  );

  const notesModal = showNotes && React.createElement(
    "div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 } },
    React.createElement(
      "div", { style: { background: "#fff", borderRadius: "10px", width: "90%", maxWidth: "480px", maxHeight: "80vh", overflowY: "auto", padding: "16px" } },
      React.createElement(
        "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
        React.createElement("h3", { style: { margin: 0, fontSize: "15px", color: "#0E4B43" } }, "📁 সেভ করা নোট"),
        React.createElement("span", { onClick: () => setShowNotes(false), style: { cursor: "pointer", fontSize: "14px", color: "#888" } }, "✕")
      ),
      notesErr && ErrorBox(notesErr),
      !notes && React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "লোড হচ্ছে..."),
      notes && notes.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো নোট সেভ করা নেই।"),
      notes && notes.map((n) =>
        React.createElement(
          "div", { key: n.id, style: { border: "1px solid #E0E4E2", borderRadius: "8px", padding: "10px", marginBottom: "8px" } },
          React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "4px" } }, (CATEGORY_LABELS[n.tag] || n.tag) + (n.sessionTitle ? " · " + n.sessionTitle : "")),
          n.attachmentUrl && React.createElement("img", { src: n.attachmentUrl, style: { maxWidth: "160px", borderRadius: "6px", marginBottom: "6px", display: "block" } }),
          React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap", color: "#333" } }, n.content),
          React.createElement("div", { style: { marginTop: "6px", display: "flex", gap: "10px" } },
            React.createElement("span", { onClick: () => handleCopy(n.content), style: { fontSize: "11px", cursor: "pointer", color: "#888" } }, "📋 কপি"),
            React.createElement("span", { onClick: () => handleDeleteNote(n.id), style: { fontSize: "11px", cursor: "pointer", color: "#C0392B" } }, "🗑️ মুছুন")
          )
        )
      )
    )
  );

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", fontFamily: "'Hind Siliguri', sans-serif" } },
    headerBar,
    tabsBar,
    React.createElement(
      "div", { style: { flex: 1, display: "flex", minHeight: 0 } },
      React.createElement(GeneralChatQuickLinks, { activeCategory, onSelectCategory: setActiveCategory }),
      React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } }, messagesArea, composer)
    ),
    React.createElement(
      "div", { style: { padding: "4px 16px", background: "#12181F", color: "#5A6B7D", fontSize: "10px" } },
      "🔒 ক্লাউড-ভিত্তিক AI (Groq) ব্যবহার হচ্ছে। এই মোডে app-এর নিজস্ব health-restriction প্রযোজ্য নয়; ব্যক্তিগত স্বাস্থ্য-পরামর্শের জন্য মূল Symptom Check ব্যবহার করুন।"
    ),
    notesModal
  );
}
