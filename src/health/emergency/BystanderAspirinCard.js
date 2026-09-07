// Suspected Heart-Attack Bystander Aspirin — Display Card (Architecture Plan
// Part B §5.4.1, §5.4.1.1)। এই card TriageResultView (৯৯৯ কল-বাটন)-এর ঠিক
// নিচে দেখানো হয় — Emergency Quick Access-এর "সাথে", কখনো বিকল্প হিসেবে না।
//
  // Fail-safe: `check` null বা blocked হলে কিছুই render করে না — কোনো edge-case/
  // missing-data ভুল দিকে ঝুঁকলে সেটা সবসময় "কম সাহায্য" (শুধু অ্যাম্বুলেন্স বলা)
  // দিকে, কখনো "বেশি সাহায্য" (ভুল aspirin suggest করা) দিকে না।

export function BystanderAspirinCard({ check }) {
  if (!check || check.blocked) return null;
  return React.createElement(
    "div",
    { style: { marginTop: "10px", padding: "12px", borderRadius: "8px", background: "#FDECEA", border: "1px solid #C0392B" } },
    React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#7A1F14" } }, "হার্ট-অ্যাটাক সন্দেহে — Bystander First-Aid"),
    React.createElement(
      "div", { style: { fontSize: "13px", color: "#333", marginTop: "6px", lineHeight: "1.5" } },
      "৯৯৯-এ কল করার সাথে সাথে/অ্যাম্বুলেন্স আসার আগে: contraindication না থাকায়, ৩০০mg Aspirin চিবিয়ে খাওয়ানো যেতে পারে (গিলে ফেলা না, একবারই)। এটা চিকিৎসা/diagnosis না — WHO/AHA/Red Cross bystander first-aid guideline অনুযায়ী established practice, ambulance/hospital-এর বিকল্প কখনো না।"
    ),
    React.createElement(
      "div", { style: { fontSize: "11px", color: "#888", marginTop: "6px" } },
      "স্ট্রোকের ক্ষেত্রে কোনো bystander-medicine নেই — এই suggestion শুধু cardiac-pattern chest-pain-এর জন্য প্রযোজ্য।"
    )
  );
}
