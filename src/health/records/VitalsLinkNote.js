// "এই একটা ইনপুট যেখানে যাবে" — শুধু তথ্য-বক্স (নতুন লজিক নেই); প্রোফাইলের ফর্ম ও ট্র্যাকারের ওজন-শিট একই বক্স দেখায়।
// ধাপ ২: লম্বা ব্যাখ্যা-বক্স এখন এক লাইন। title প্রপ আর দেখানো হয় না (পুরনো কলারে নিরাপদ)।
const h = React.createElement;

export function VitalsLinkNote() {
  return h("div", { style: { background: "#E4F0E9", border: "1px solid #CFE0D6", borderRadius: "12px", padding: "8px 12px", margin: "8px 0", fontSize: "13px", lineHeight: 1.4, color: "#1F2D2A" } },
    "🔗 প্রোফাইল, BMI, ট্রেন্ড, রিপোর্ট ও টাইমলাইনে একসাথে যাবে।");
}
