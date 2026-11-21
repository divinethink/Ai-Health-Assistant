// নিচ থেকে ওঠা শিট (মোবাইল-অ্যাপের স্ট্যান্ডার্ড ডিটেইল/সম্পাদনা প্যাটার্ন)।
// body-তে portal: নেভ-বার ও ＋ বাটনের উপরে আসে; ভেতরে নিজস্ব স্ক্রল; পেছনের পেজ নড়ে না।
// ব্যাকড্রপ-চাপ বন্ধ করে (lockBackdrop=true হলে করে না — ফর্মের লেখা হারানো ঠেকাতে); ✕, Esc ও ফোনের Back-এও বন্ধ।
// শুধু presentation — কোনো ডেটা/state-logic নেই।
import { createPortal } from "react-dom";
import { useBackClose } from "./navHistory.js";
import { CloseX } from "./ui.js";

export function BottomSheet({ title, onClose, lockBackdrop, hideHeader, children }) {
  const [shown, setShown] = React.useState(false);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  useBackClose(onClose);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // পেছনের পেজ স্ক্রল হয় না
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return createPortal(React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 80, fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', sans-serif" } },
    React.createElement("div", { "aria-hidden": "true", onClick: lockBackdrop ? undefined : onClose, style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", opacity: shown ? 1 : 0, transition: "opacity .2s" } }),
    React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": title || "বিস্তারিত", style: { position: "absolute", left: 0, right: 0, bottom: 0, maxWidth: "640px", margin: "0 auto", maxHeight: "88%", display: "flex", flexDirection: "column", background: "var(--hs-canvas, #F6FAF7)", borderRadius: "24px 24px 0 0", boxShadow: "0 -8px 30px rgba(0,0,0,0.18)", transform: shown ? "translateY(0)" : "translateY(100%)", transition: "transform .25s ease-out", paddingBottom: "env(safe-area-inset-bottom, 0px)" } },
      React.createElement("div", { style: { width: "44px", height: "5px", borderRadius: "3px", background: "#C9D6CF", margin: "8px auto 0", flexShrink: 0 } }),
      !hideHeader && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px 4px 18px", flexShrink: 0 } },
        React.createElement("div", { style: { flex: 1, minWidth: 0, fontSize: "17px", fontWeight: 800, color: "#1F2D2A", overflowWrap: "anywhere" } }, title),
        CloseX(onClose)),
      React.createElement("div", { style: { flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: hideHeader ? "8px 16px 20px" : "0 16px 20px" } }, children))), document.body);
}
