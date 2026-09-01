// Walking Skeleton — Step 2: Anonymous auth bootstrap + UID display.
//
// DailyTask-এর প্রমাণিত pattern reuse (app.js-এর auth.onAuthStateChanged
// bootstrap লজিক): প্রথমবার কোনো user না থাকলে auto signInAnonymously()।
// এই UID-ই পরে familyIdentity.js/memberData.js-এ ownerUids/adminUids-এর
// ভিত্তি হবে। এখানে শুধু UID দেখানো হচ্ছে যাতে আপনি সেটা কপি করে
// firestore_rules_FINAL.md-এর OWNER_UID_PLACEHOLDER-এ বসাতে পারেন —
// এখনো কোনো Family/Member ফিচার নেই (পরের কমিটে)।
import { auth, initError } from "./firebaseConfig.js";

const { useState, useEffect } = React;

function BootCheck() {
  const [uid, setUid] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "(missing)";

  useEffect(() => {
    if (!auth) {
      setAuthState("unavailable (Firebase init failed — নিচে দেখুন)");
      return;
    }
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setUid(user.uid);
        setAuthState("connected (anonymous)");
      } else {
        setAuthState("signing in...");
        auth.signInAnonymously().catch((err) => {
          setAuthState("sign-in error: " + err.message);
        });
      }
    }, (err) => setAuthState("error: " + err.message));
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
      React.createElement("div", null, "Auth status: ", React.createElement("b", null, authState))
    ),
    uid && React.createElement(
      "div",
      { style: { marginTop: "16px", padding: "12px", borderRadius: "8px", background: "#E8F3EC", border: "2px solid #0E4B43" } },
      React.createElement("div", { style: { fontSize: "13px", color: "#333", marginBottom: "6px" } }, "আপনার UID (rules-এর OWNER_UID_PLACEHOLDER-এ বসবে):"),
      React.createElement("div", { style: { fontFamily: "monospace", fontSize: "13px", wordBreak: "break-all", userSelect: "all" } }, uid)
    ),
    initError && React.createElement(
      "div",
      {
        style: {
          marginTop: "16px", padding: "12px", borderRadius: "8px",
          background: "#FDECEA", border: "2px solid #C0392B", color: "#7A1F14",
          fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap"
        }
      },
      "Firebase init error:\n" + initError
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(BootCheck));
