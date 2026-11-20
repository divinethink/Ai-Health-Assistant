// রেন্ডার-ত্রুটিতে সাদা পর্দার বদলে সহজ বার্তা + পুনরায় চালুর বাটন।
// ত্রুটির বিস্তারিত শুধু console-এ যায়; স্ক্রিনে স্বাস্থ্য-তথ্য বা কোড-লেখা দেখানো হয় না।
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[ErrorBoundary]", err); }
  render() {
    if (!this.state.failed) return this.props.children;
    const h = React.createElement;
    return h("div", { role: "alert", style: { padding: "24px 16px", textAlign: "center", color: "var(--hs-text, #1F2D2A)", fontFamily: "inherit" } },
      h("h2", { style: { fontSize: "18px", margin: "0 0 8px" } }, "কিছু একটা ঠিকমতো চলেনি"),
      h("p", { style: { fontSize: "14px", margin: "0 0 16px" } }, "আপনার তথ্য নিরাপদ আছে। অ্যাপটি আবার চালু করুন।"),
      h("button", { type: "button", onClick: () => window.location.reload(), style: { minHeight: "44px", padding: "0 20px", borderRadius: "12px", border: "none", background: "var(--hs-primary, #0E4B43)", color: "#fff", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" } }, "আবার চালু করুন"));
  }
}
