// ফোনের Back বাটন: ট্যাব-ভেতরের পিল/সাব-ট্যাবও browser-history-তে (Dashboard-এর ট্যাব/ওভারলে এন্ট্রির সাথে একই state-অবজেক্টে `inner`)।
// UI-মুক্ত, state-মুক্ত হেল্পার: histBind = রেন্ডারে নিবন্ধন; histChange = ইউজার-ট্যাপে এন্ট্রি যোগ; histRestore = popstate-এ ফিরিয়ে আনা।
// নির্বাচিত সদস্য/ডেটা এখানে নেই — শুধু "কোন পিল সক্রিয়" (স্ট্রিং)।
const reg = new Map();
let pending = null;
let timer = null;

export function histBind(key, active, onChange) {
  reg.set(key, onChange);
  if (pending && Object.prototype.hasOwnProperty.call(pending, key)) {
    const v = pending[key];
    delete pending[key];
    if (v !== active) setTimeout(() => onChange(v), 0);
  }
}

export function histChange(key, prev, next, onChange) {
  if (prev !== next) {
    try {
      const st = window.history.state || { hs: 1 };
      const inner = { ...(st.inner || {}), [key]: prev };
      window.history.replaceState({ ...st, inner }, "");
      window.history.pushState({ ...st, inner: { ...inner, [key]: next } }, "");
    } catch (_e) { /* history ব্যর্থ হলেও পিল বদলায় */ }
  }
  onChange(next);
}

export function histRestore(inner) {
  pending = { ...(inner || {}) };
  reg.forEach((cb, k) => { if (Object.prototype.hasOwnProperty.call(pending, k)) cb(pending[k]); });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { pending = null; }, 800);
}

// ---- শিট/ওভারলে + ফোনের Back: শিট খুললে history-তে একটা এন্ট্রি; Back = শুধু ওপরের শিট বন্ধ (পেজ বদলায় না) ----
// UI-বোতামে বন্ধ হলে নিজের এন্ট্রি history.back() দিয়ে সরানো হয় (skip দিয়ে পরের শিট/ডিটেক্টর ভুল সাড়া দেয় না)।
const sheetStack = [];
let skipPops = 0;
let sheetListening = false;

function onSheetPop() {
  if (skipPops > 0) { skipPops--; return; }
  const top = sheetStack[sheetStack.length - 1];
  if (top) { top.popped = true; top.close(); }
}

export function useBackClose(onClose) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const token = { popped: false, close: () => closeRef.current() };
    let pushed = false;
    try {
      const st = window.history.state || {};
      window.history.pushState({ ...st, sheet: sheetStack.length + 1 }, "");
      pushed = true;
    } catch (_e) { /* history ব্যর্থ হলেও শিট চলে */ }
    sheetStack.push(token);
    if (!sheetListening) { window.addEventListener("popstate", onSheetPop); sheetListening = true; }
    return () => {
      const i = sheetStack.indexOf(token);
      if (i >= 0) sheetStack.splice(i, 1);
      if (pushed && !token.popped) {
        try {
          const s = window.history.state;
          if (s && s.sheet) { skipPops++; window.history.back(); }
        } catch (_e) { /* উপেক্ষা */ }
      }
    };
  }, []);
}
