// General Chat — Admin-only special mode। বাকি অ্যাপ থেকে ইচ্ছাকৃতভাবে ভিন্ন
// visual-identity (dark drawer + full-screen takeover)।
//
// আপডেট (এই থ্রেড, owner-approved সিদ্ধান্ত-পরিবর্তন): আগের ephemeral/
// per-message-save মডেল বাদ — এখন প্রতিটা session Firestore-এ auto-save হয়
// (HealthEpisode/EpisodeMessage pattern reuse), delete শুধু পুরো session-scope-এ।
// নতুন সংযোজন: collapsible drawer-এ ৩ ট্যাব (Chats/Quick Links/Projects),
// lightweight Project (Knowledge+Instructions), sources/citation প্রদর্শন।

import { ErrorBox } from "../../shared/ui.js";
import { GeneralChatQuickLinks } from "./GeneralChatQuickLinks.js";
import { askGeneralChat } from "./generalChatClient.js";
import {
  uploadGeneralChatImage, deleteGeneralChatImage, validateGeneralChatImage,
  createGeneralChatSession, listGeneralChatSessions, loadGeneralChatMessages,
  addGeneralChatMessage, deleteGeneralChatSession,
  createGeneralChatProject, updateGeneralChatProject, listGeneralChatProjects, deleteGeneralChatProject,
  KNOWLEDGE_MAX_CHARS,
} from "./generalChatData.js";

const { useState, useEffect, useRef, useCallback } = React;

// Length-management (owner-approved, এই থ্রেড) — একটা single conversation-এর
// API-তে পাঠানো payload-এর সর্বোচ্চ সীমা। পূর্ণ history সবসময় Firestore/UI-তে
// অক্ষত থাকে (unbounded, user দেখতে পারবেন) — শুধু AI-কে পাঠানো window সীমিত,
// যাতে দীর্ঘ গবেষণা-চ্যাট কখনো model-এর context-limit-এ আটকে না যায় বা
// ব্যর্থ না হয়। ~২৪,০০০ character ≈ ৬,০০০ token estimate — সবচেয়ে সীমিত
// fallback provider (OpenRouter free-tier, প্রায়ই ৮k context)-এর জন্যও নিরাপদ
// margin রাখা হয়েছে।
const MAX_API_HISTORY_CHARS = 24000;

function trimHistoryForApi(msgs) {
  let total = 0;
  const kept = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const len = (m.text || "").length + (m.imageUrl ? 200 : 0);
    if (kept.length > 0 && total + len > MAX_API_HISTORY_CHARS) break;
    total += len;
    kept.unshift(m);
  }
  return kept;
}

// Lightweight markdown render (owner-approved UI-suggestion) — **bold**, বুলেট
// লাইন (- বা •), ও লাইন-ব্রেক — কোনো নতুন npm dependency ছাড়াই (Process Rule ৮)।
function renderInlineBold(line) {
  const parts = String(line).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? React.createElement("strong", { key: i }, p.slice(2, -2)) : p));
}

function renderLiteMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split("\n");
  const nodes = [];
  let listBuffer = [];
  function flushList(key) {
    if (listBuffer.length) {
      nodes.push(React.createElement("ul", { key: "ul-" + key, style: { margin: "4px 0", paddingLeft: "18px" } }, listBuffer));
      listBuffer = [];
    }
  }
  lines.forEach((line, idx) => {
    const bulletMatch = /^[-•]\s+(.*)/.exec(line.trim());
    if (bulletMatch) {
      listBuffer.push(React.createElement("li", { key: idx }, renderInlineBold(bulletMatch[1])));
      return;
    }
    flushList(idx);
    if (line.trim() === "") nodes.push(React.createElement("div", { key: idx, style: { height: "8px" } }));
    else nodes.push(React.createElement("div", { key: idx }, renderInlineBold(line)));
  });
  flushList("end");
  return nodes;
}

export function GeneralChatSection({ familyId, onExit }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("chats"); // "chats" | "quicklinks" | "projects"

  const [sessions, setSessions] = useState(null);
  const [sessionsErr, setSessionsErr] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null); // null = নতুন/অসৃষ্ট চ্যাট
  const [activeMessages, setActiveMessages] = useState([]);
  const [activeTitle, setActiveTitle] = useState("নতুন চ্যাট");

  const [projects, setProjects] = useState(null);
  const [projectsErr, setProjectsErr] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null); // নতুন চ্যাট শুরু করার সময় বাছাইযোগ্য
  const [editingProject, setEditingProject] = useState(null); // null | "new" | project-object

  const [activeCategory, setActiveCategory] = useState("misc");
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null); // {secureUrl, publicId, resourceType, uploading}
  const [contextTrimmed, setContextTrimmed] = useState(false); // length-management indicator
  const messagesEndRef = useRef(null);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [retryNote, setRetryNote] = useState(null);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  function refreshSessions() {
    listGeneralChatSessions(familyId).then(setSessions).catch((e) => setSessionsErr(e.message || String(e)));
  }
  function refreshProjects() {
    listGeneralChatProjects(familyId).then(setProjects).catch((e) => setProjectsErr(e.message || String(e)));
  }
  useEffect(() => { refreshSessions(); refreshProjects(); }, [familyId]);

  // Desktop-এ ডিফল্টে drawer খোলা, mobile-এ বন্ধ (owner-confirmed, item #৪) —
  // শুধু mount-এ একবার viewport-width চেক, পরে user টগল করলে সেটাই মান্য হবে।
  useEffect(() => {
    if (window.innerWidth >= 900) setSidebarOpen(true);
  }, []);

  // Auto-scroll (owner-approved UI-suggestion) — নতুন message এলে নিচে scroll।
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const activeProject = (projects || []).find((p) => p.id === activeProjectId) || null;

  function startNewChat() {
    setActiveSessionId(null);
    setActiveMessages([]);
    setActiveTitle("নতুন চ্যাট");
    setContextTrimmed(false);
    setSidebarOpen(false);
  }

  function openSession(session) {
    setActiveSessionId(session.id);
    setActiveTitle(session.title);
    setActiveProjectId(session.projectId || null);
    setActiveMessages([]);
    setContextTrimmed(false);
    loadGeneralChatMessages(familyId, session.id).then(setActiveMessages).catch((e) => setErr(e.message || String(e)));
    setSidebarOpen(false);
  }

  async function handleDeleteSession(e, sessionId) {
    e.stopPropagation();
    if (!window.confirm("এই পুরো চ্যাট স্থায়ীভাবে মুছে ফেলবেন?")) return;
    try {
      await deleteGeneralChatSession(familyId, sessionId);
      if (activeSessionId === sessionId) startNewChat();
      refreshSessions();
    } catch (e2) {
      setErr(e2.message || String(e2));
    }
  }

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
    // এখনো কোনো message-এ persist হয়নি — composer থেকে বাদ দিলে সরাসরি cleanup।
    if (pendingImage && pendingImage.publicId) {
      deleteGeneralChatImage(familyId, pendingImage.publicId, pendingImage.resourceType);
    }
    setPendingImage(null);
  }

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
      role: "user", text: trimmed,
      imageUrl: pendingImage ? pendingImage.secureUrl : null,
      imagePublicId: pendingImage ? pendingImage.publicId : null,
      imageResourceType: pendingImage ? pendingImage.resourceType : null,
      tag: activeCategory,
    };

    setText("");
    setPendingImage(null);
    setLoading(true);
    setErr(null);
    setRetryNote(null);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const title = trimmed ? trimmed.slice(0, 30) : "ছবি-সহ চ্যাট";
        sessionId = await createGeneralChatSession(familyId, { title, projectId: activeProjectId });
        setActiveSessionId(sessionId);
        setActiveTitle(title);
      }

      const fullHistory = [...activeMessages, userMsg];
      setActiveMessages(fullHistory); // optimistic UI — পূর্ণ history সবসময় UI/Firestore-এ অক্ষত
      await addGeneralChatMessage(familyId, sessionId, userMsg);

      // Length-management (owner-approved) — AI-কে শুধু সাম্প্রতিক window পাঠানো
      // হয়, পুরো history না। এতে দীর্ঘ চ্যাটেও model context-limit-এ আটকে না।
      const apiHistory = trimHistoryForApi(fullHistory);
      setContextTrimmed(apiHistory.length < fullHistory.length);

      const hasImages = !!userMsg.imageUrl;
      const data = await askGeneralChat(familyId, buildPayloadMessages(apiHistory), {
        useWebSearch: hasImages ? false : useWebSearch,
        hasImages,
        projectContext: activeProject ? { instructions: activeProject.instructions, knowledge: activeProject.knowledge } : null,
        onRetry: (a, m) => setRetryNote(`একটু অপেক্ষা করুন... (retry ${a}/${m})`),
      });

      const aiMsg = {
        role: "assistant", text: data && data.content, tag: activeCategory,
        sources: (data && data.sources) || [], searchUsed: !!(data && data.searchUsed),
      };
      setActiveMessages((prev) => [...prev, aiMsg]);
      await addGeneralChatMessage(familyId, sessionId, aiMsg);
      refreshSessions(); // updatedAt বদলেছে, list-order refresh
    } catch (e) {
      const msg = e.message || String(e);
      // bug-fix (owner-reported): provider-level raw error (JSON dump, যেমন
      // Groq OTPM-429 বার্তা) আগে সরাসরি user-কে দেখানো হতো — এখন সবসময়
      // পরিষ্কার বাংলা বার্তা দেখানো হবে, raw detail শুধু console-এ থাকবে।
      console.error("General Chat error:", msg);
      if (msg.includes("admin-only")) setErr("শুধু Admin General Chat ব্যবহার করতে পারবেন।");
      else if (/-429\b|rate.?limit/i.test(msg)) setErr("⚠️ এই মুহূর্তে AI সার্ভারে চাপ বেশি — কিছুক্ষণ পর আবার চেষ্টা করুন।");
      else setErr("⚠️ এই মুহূর্তে উত্তর তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
      setRetryNote(null);
    }
  }

  // handleCopy সরানো হয়েছে (owner-request) — এখন standard long-press/select
  // দিয়েই টেক্সট কপি করা যায়, আলাদা "📋 কপি" UI লাগে না।

  // ---------------- Project editor (inline, ছোট modal) ----------------

  function openNewProject() { setEditingProject({ mode: "new", name: "", instructions: "", knowledge: "" }); }
  function openEditProject(p) { setEditingProject({ mode: "edit", id: p.id, name: p.name, instructions: p.instructions, knowledge: p.knowledge }); }

  async function saveProject() {
    try {
      if (editingProject.mode === "new") {
        await createGeneralChatProject(familyId, editingProject);
      } else {
        await updateGeneralChatProject(familyId, editingProject.id, editingProject);
      }
      setEditingProject(null);
      refreshProjects();
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  async function handleDeleteProject(e, projectId) {
    e.stopPropagation();
    if (!window.confirm("এই Project মুছে ফেলবেন? (এর সাথে যুক্ত চ্যাটগুলো মুছবে না)")) return;
    try {
      await deleteGeneralChatProject(familyId, projectId);
      if (activeProjectId === projectId) setActiveProjectId(null);
      refreshProjects();
    } catch (e2) {
      setErr(e2.message || String(e2));
    }
  }

  // ---------------- Render ----------------

  const headerBar = React.createElement(
    "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#12181F", color: "#fff" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 } },
      React.createElement(
        "button", {
          onClick: () => setSidebarOpen((v) => !v), title: "মেনু",
          style: { background: sidebarOpen ? "#22303F" : "none", border: "1px solid #3A4756", color: "#D6DEE6", fontSize: "16px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", flexShrink: 0 },
        }, "☰"
      ),
      React.createElement("span", { style: { fontSize: "14px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "🌐 " + activeTitle)
    ),
    React.createElement("span", { style: { fontSize: "11px", color: "#8FA0B3", border: "1px solid #3A4756", borderRadius: "4px", padding: "1px 6px", flexShrink: 0 } }, "Admin")
  );

  const drawerTabsBar = React.createElement(
    "div", { style: { display: "flex", borderBottom: "1px solid #2A3542" } },
    [["chats", "💬 Chats"], ["quicklinks", "🔗 Quick Links"], ["projects", "📁 Projects"]].map(([key, label]) =>
      React.createElement(
        "div", {
          key, onClick: () => setDrawerTab(key),
          style: { flex: 1, textAlign: "center", padding: "8px 4px", fontSize: "11px", cursor: "pointer", color: drawerTab === key ? "#fff" : "#8FA0B3", borderBottom: drawerTab === key ? "2px solid #4FC3A1" : "2px solid transparent" },
        }, label
      )
    )
  );

  const chatsPanel = React.createElement(
    "div", { style: { width: "100%", height: "100%", background: "#1B2430", color: "#D6DEE6", display: "flex", flexDirection: "column" } },
    drawerTabsBar,
    React.createElement(
      "button", { onClick: startNewChat, style: { margin: "10px 12px", padding: "8px", border: "1px dashed #3A4756", background: "none", color: "#D6DEE6", borderRadius: "6px", cursor: "pointer", fontSize: "12px" } },
      "+ নতুন চ্যাট"
    ),
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto" } },
      sessionsErr && React.createElement("div", { style: { padding: "8px 12px", fontSize: "11px", color: "#E88" } }, sessionsErr),
      !sessions && React.createElement("div", { style: { padding: "8px 12px", fontSize: "12px", color: "#8FA0B3" } }, "লোড হচ্ছে..."),
      sessions && sessions.length === 0 && React.createElement("div", { style: { padding: "8px 12px", fontSize: "12px", color: "#8FA0B3" } }, "কোনো পুরনো চ্যাট নেই।"),
      (sessions || []).map((s) =>
        React.createElement(
          "div", {
            key: s.id, onClick: () => openSession(s),
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", fontSize: "12px", background: s.id === activeSessionId ? "#2A3F52" : "transparent" },
          },
          React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.title),
          React.createElement("span", { onClick: (e) => handleDeleteSession(e, s.id), style: { color: "#8A97A5", padding: "0 4px" } }, "🗑️")
        )
      )
    )
  );

  const projectsPanel = React.createElement(
    "div", { style: { width: "100%", height: "100%", background: "#1B2430", color: "#D6DEE6", display: "flex", flexDirection: "column" } },
    drawerTabsBar,
    React.createElement(
      "button", { onClick: openNewProject, style: { margin: "10px 12px", padding: "8px", border: "1px dashed #3A4756", background: "none", color: "#D6DEE6", borderRadius: "6px", cursor: "pointer", fontSize: "12px" } },
      "+ নতুন Project"
    ),
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto" } },
      projectsErr && React.createElement("div", { style: { padding: "8px 12px", fontSize: "11px", color: "#E88" } }, projectsErr),
      !projects && React.createElement("div", { style: { padding: "8px 12px", fontSize: "12px", color: "#8FA0B3" } }, "লোড হচ্ছে..."),
      projects && projects.length === 0 && React.createElement("div", { style: { padding: "8px 12px", fontSize: "12px", color: "#8FA0B3" } }, "কোনো Project নেই।"),
      (projects || []).map((p) =>
        React.createElement(
          "div", {
            key: p.id, onClick: () => openEditProject(p),
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", fontSize: "12px", background: p.id === activeProjectId ? "#2A3F52" : "transparent" },
          },
          React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name),
          React.createElement("span", { onClick: (e) => handleDeleteProject(e, p.id), style: { color: "#8A97A5", padding: "0 4px" } }, "🗑️")
        )
      )
    )
  );

  let sidebarPanel = null;
  if (drawerTab === "chats") sidebarPanel = chatsPanel;
  else if (drawerTab === "projects") sidebarPanel = projectsPanel;
  else sidebarPanel = React.createElement(
    "div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column" } },
    drawerTabsBar,
    React.createElement("div", { style: { flex: 1, overflow: "hidden" } },
      React.createElement(GeneralChatQuickLinks, { activeCategory, onSelectCategory: setActiveCategory })
    )
  );

  const messagesArea = React.createElement(
    "div", { style: { flex: 1, overflowY: "auto", padding: "16px", background: "#F5F7F9" } },
    activeMessages.length === 0 && React.createElement(
      "div", { style: { color: "#8A97A5", fontSize: "13px", textAlign: "center", marginTop: "40px" } },
      "যেকোনো বিষয়ে প্রশ্ন করুন — কৃষি/নার্সারি, ধর্মীয়, রাজনীতি, অর্থনীতি, ইতিহাস, ভূতত্ত্ব, গবেষণা, সাধারণ চিকিৎসা-জ্ঞান — সব খোলা। এটি স্বাস্থ্য-পরামর্শের জন্য নয়; ব্যক্তিগত উপসর্গের ক্ষেত্রে মূল Symptom Check ব্যবহার করুন।"
    ),
    activeMessages.map((m, i) =>
      React.createElement(
        "div", { key: m.id || i, style: { display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: "10px" } },
        React.createElement(
          "div", { style: { maxWidth: "78%", background: m.role === "user" ? "#0E4B43" : "#fff", color: m.role === "user" ? "#fff" : "#222", border: m.role === "user" ? "none" : "1px solid #E0E4E2", borderRadius: "10px", padding: "10px 12px" } },
          m.imageUrl && React.createElement("img", { src: m.imageUrl, style: { maxWidth: "220px", borderRadius: "6px", display: "block", marginBottom: m.text ? "6px" : 0 } }),
          m.text && React.createElement("div", { style: { fontSize: "13px", lineHeight: "1.7" } }, renderLiteMarkdown(m.text)),
          m.sources && m.sources.length > 0 && React.createElement(
            "div", { style: { marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #EEE", fontSize: "10px" } },
            React.createElement("div", { style: { color: "#888", marginBottom: "2px" } }, "🔗 সূত্র:"),
            m.sources.slice(0, 5).map((s, si) =>
              React.createElement("a", { key: si, href: s.url, target: "_blank", rel: "noopener noreferrer", style: { display: "block", color: "#3B7DBF", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.title || s.url)
            )
          )
        )
      )
    ),
    React.createElement("div", { ref: messagesEndRef }),
    err && ErrorBox(err),
    retryNote && React.createElement("div", { style: { fontSize: "11px", color: "#7A5B00" } }, retryNote),
    contextTrimmed && React.createElement(
      "div", { style: { fontSize: "11px", color: "#7A5B00", background: "#FFF6DD", border: "1px solid #F0DFA0", borderRadius: "6px", padding: "6px 10px", marginTop: "6px" } },
      "⚠️ আলোচনা অনেক বড় হয়ে গেছে — AI এখন শুধু সাম্প্রতিক অংশ মনে রাখছে (পুরনো অংশ এখানে দেখা যাচ্ছে, শুধু AI-কে পাঠানো হচ্ছে না)। নতুন প্রসঙ্গের জন্য চাইলে নতুন চ্যাট শুরু করুন।"
    )
  );

  const composer = React.createElement(
    "div", { style: { padding: "10px 16px", background: "#fff", borderTop: "1px solid #E0E4E2" } },
    !activeSessionId && projects && projects.length > 0 && React.createElement(
      "div", { style: { marginBottom: "6px", fontSize: "11px", color: "#666", display: "flex", alignItems: "center", gap: "6px" } },
      "Project:",
      React.createElement(
        "select", {
          value: activeProjectId || "", onChange: (e) => setActiveProjectId(e.target.value || null),
          style: { fontSize: "11px", padding: "3px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" },
        },
        React.createElement("option", { value: "" }, "কোনোটি না"),
        projects.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.name))
      )
    ),
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

  const projectEditorModal = editingProject && React.createElement(
    "div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 60 } },
    React.createElement(
      "div", { style: { background: "#fff", borderRadius: "10px", width: "90%", maxWidth: "420px", maxHeight: "85vh", overflowY: "auto", padding: "16px" } },
      React.createElement("h3", { style: { margin: "0 0 10px", fontSize: "15px", color: "#0E4B43" } }, editingProject.mode === "new" ? "নতুন Project" : "Project সম্পাদনা"),
      React.createElement("input", {
        placeholder: "Project-এর নাম", value: editingProject.name,
        onChange: (e) => setEditingProject({ ...editingProject, name: e.target.value }),
        style: { width: "100%", padding: "8px", marginBottom: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px" },
      }),
      React.createElement("textarea", {
        placeholder: "Instructions (AI কীভাবে আচরণ করবে)", value: editingProject.instructions, rows: 3,
        onChange: (e) => setEditingProject({ ...editingProject, instructions: e.target.value }),
        style: { width: "100%", padding: "8px", marginBottom: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit" },
      }),
      React.createElement("textarea", {
        placeholder: "Knowledge (প্রাসঙ্গিক তথ্য পেস্ট করুন)", value: editingProject.knowledge, rows: 6,
        maxLength: KNOWLEDGE_MAX_CHARS,
        onChange: (e) => setEditingProject({ ...editingProject, knowledge: e.target.value }),
        style: { width: "100%", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit" },
      }),
      React.createElement("div", { style: { fontSize: "10px", color: "#999", textAlign: "right", marginBottom: "10px" } }, `${(editingProject.knowledge || "").length}/${KNOWLEDGE_MAX_CHARS}`),
      React.createElement(
        "div", { style: { display: "flex", gap: "8px", justifyContent: "flex-end" } },
        React.createElement("button", { onClick: () => setEditingProject(null), style: { padding: "8px 14px", border: "1px solid #CBD5E1", background: "#fff", borderRadius: "6px", cursor: "pointer", fontSize: "12px" } }, "বাতিল"),
        React.createElement("button", { onClick: saveProject, style: { padding: "8px 14px", border: "none", background: "#0E4B43", color: "#fff", borderRadius: "6px", cursor: "pointer", fontSize: "12px" } }, "সেভ করুন")
      )
    )
  );

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", fontFamily: "'Hind Siliguri', sans-serif" } },
    headerBar,
    React.createElement(
      "div", { style: { flex: 1, display: "flex", minHeight: 0, position: "relative" } },
      sidebarOpen && React.createElement(
        React.Fragment, null,
        React.createElement("div", { onClick: () => setSidebarOpen(false), style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 20 } }),
        React.createElement(
          "div", { style: { position: "absolute", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: "280px", zIndex: 21, boxShadow: "3px 0 10px rgba(0,0,0,0.4)" } },
          sidebarPanel
        )
      ),
      React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } }, messagesArea, composer)
    ),
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 16px", background: "#12181F", color: "#5A6B7D", fontSize: "10px" } },
      React.createElement("button", { onClick: onExit, style: { background: "none", border: "1px solid #3A4756", color: "#A9C4DE", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", cursor: "pointer", flexShrink: 0 } }, "← ফিরে যান"),
      React.createElement("span", null, "🔒 ক্লাউড-ভিত্তিক AI ব্যবহার হচ্ছে। এই মোডে app-এর নিজস্ব health-restriction প্রযোজ্য নয়; ব্যক্তিগত স্বাস্থ্য-পরামর্শের জন্য মূল Symptom Check ব্যবহার করুন।")
    ),
    projectEditorModal
  );
}
