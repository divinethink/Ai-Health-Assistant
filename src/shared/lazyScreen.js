// পর্দা-স্তরের lazy load: কম্পোনেন্ট প্রথমবার দেখানোর সময়ই তার কোড নামে।
// লোড হওয়ার সময় ছোট spinner (`.hc-spin`, index.html-এর স্টাইল); চাঙ্ক না এলে
// (নেটওয়ার্ক বা নতুন ডেপ্লয়ের পর) ErrorBoundary "আবার চালু করুন" দেখায়।
const { lazy, Suspense } = React;

function ScreenFallback() {
  return React.createElement("div", { role: "status", "aria-label": "লোড হচ্ছে", style: { display: "flex", justifyContent: "center", padding: "40px 0" } },
    React.createElement("div", { className: "hc-spin" }));
}

export function lazyScreen(loader, exportName) {
  const Inner = lazy(() => loader().then((m) => ({ default: m[exportName] })));
  function LazyScreen(props) {
    return React.createElement(Suspense, { fallback: React.createElement(ScreenFallback) }, React.createElement(Inner, props));
  }
  return LazyScreen;
}
