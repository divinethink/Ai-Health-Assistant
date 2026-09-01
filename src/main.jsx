// globals.js MUST be imported first: it attaches React/ReactDOM/firebase to
// `window` before legacy/app.js (which will read them as bare globals,
// DailyTask pattern reused) executes. Import order below = evaluation order.
import "./globals.js";
import "./legacy/app.js";
