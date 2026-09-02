// family-level join-request gate — member-profile না থাকা, non-admin uid-এর
// জন্য। Live listener দিয়ে status বদলালে সাথে সাথে UI আপডেট হয়। app.js থেকে
// split (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { Card, PrimaryButton, ErrorBox } from "../shared/ui.js";
import { ensureAccessRequest, listenAccessRequest } from "../legacy/accessRequests.js";

const { useState, useEffect, useCallback } = React;

export function JoinRequestGate({ familyId, uid }) {
  const [reqData, setReqData] = useState(undefined); // undefined=লোড হচ্ছে, null=নেই
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => listenAccessRequest(familyId, uid, setReqData), [familyId, uid]);

  const send = useCallback(async () => {
    setErr(null); setBusy(true);
    try { await ensureAccessRequest(familyId, uid); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }, [familyId, uid]);

  if (reqData === undefined) return Card("লোড হচ্ছে...");

  if (reqData === null) {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "এই পরিবারে যোগ দিন"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } },
          "আপনার এখনো এই পরিবারে কোনো প্রোফাইল নেই। যদি Admin আপনাকে একটা Key দিয়ে থাকেন, তাহলে ফিরে গিয়ে \"Key দিয়ে লগইন\" ব্যবহার করুন। Key না থাকলে, নিচের বাটনে যোগদানের অনুরোধ পাঠান — Admin অনুমোদন করলে আপনি পরিবারের অংশ হবেন।"
        ),
        err && ErrorBox(err),
        PrimaryButton("যোগদানের অনুরোধ পাঠান", send, busy)
      )
    );
  }

  if (reqData.status === "pending") {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "অনুমোদনের অপেক্ষায়"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনার যোগদানের অনুরোধ Admin-এর কাছে পাঠানো হয়েছে। অনুমোদন হলে এই পাতা নিজে থেকেই আপডেট হবে।")
      )
    );
  }

  if (reqData.status === "denied") {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "অনুরোধ প্রত্যাখ্যাত"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনার যোগদানের অনুরোধ Admin প্রত্যাখ্যান করেছেন। প্রশ্ন থাকলে Admin-এর সাথে সরাসরি যোগাযোগ করুন।")
      )
    );
  }

  // status === "approved": family-level সদস্য হয়েছেন, কিন্তু এখনো নিজের
  // Member profile/Key নেই — সেটা Admin-কে যোগ করতে হবে (আগের ধাপের ফিচার)।
  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "যোগদান অনুমোদিত ✓"),
      React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনি এখন এই পরিবারের অংশ। আপনার নিজের প্রোফাইল/Key-এর জন্য Admin-কে বলুন — Key পেলে \"Key দিয়ে লগইন\" থেকে claim করবেন।")
    )
  );
}
