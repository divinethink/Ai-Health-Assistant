// "এই একটা ইনপুট যেখানে যাবে" — মকআপ ৩/৪। শুধু তথ্য-বক্স (নতুন লজিক নেই); প্রোফাইলের ফর্ম ও ট্র্যাকারের ওজন-শিট একই বক্স দেখায়।
const h = React.createElement;
const ITEMS = ["প্রোফাইল (স্বাস্থ্য তথ্য)", "BMI", "ওজনের ট্রেন্ড", "ডাক্তার-রিপোর্ট", "টাইমলাইন"];

export function VitalsLinkNote({ title }) {
  return h("div", { style: { background: "#E4F0E9", border: "1px solid #CFE0D6", borderRadius: "14px", padding: "10px 12px", margin: "10px 0" } },
    h("div", { style: { fontSize: "14px", fontWeight: 700, color: "#0E4B43", marginBottom: "6px" } }, "🔗 " + (title || "এই একটা ইনপুট যেখানে যাবে")),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", fontSize: "14px", color: "#1F2D2A" } },
      ITEMS.map((x) => h("div", { key: x }, "✓ " + x))));
}
