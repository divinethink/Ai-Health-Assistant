// Walking Skeleton — Step 1: Hello World boot-check.
//
// উদ্দেশ্য শুধু এটা যাচাই করা যে পুরো পাইপলাইন (GitHub → Cloudflare Pages
// build → env-vars → Firebase connect) কাজ করছে। কোনো Onboarding/Family/
// Member feature এখনো এখানে নেই — সেগুলো এই ধাপ verify হওয়ার পরের কমিটে
// যোগ হবে (Process Rule ১০ — Verify-before-proceed)।
import { auth } from "./firebaseConfig.js";

const { useState, useEffect } = React;

function BootCheck() {
  const [authState, setAuthState] = useState("checking");
  const [projectId, setProjectId] = useState(import.meta.env.VITE_FIREBASE_PROJECT_ID || "(missing)");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(
      () => setAuthState("connected"),
      (err) => setAuthState("error: " + err.message)
    );
    return () => unsub();
  }, []);

  return React.createElement(
    "div",
    { style: { padding: "24px", maxWidth: "420px", margin: "40px auto", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
    React.createElement("p", { style: { color: "#555" } }, "Walking Skeleton — সংযোগ পরীক্ষা"),
    React.createElement(
      "div",
      { style: { background: "#F5F5F0", padding: "12px", borderRadius: "8px", marginTop: "12px" } },
      React.createElement("div", null, "Firebase Project ID: ", React.createElement("b", null, projectId)),
      React.createElement("div", null, "Auth SDK status: ", React.createElement("b", null, authState))
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(BootCheck));
