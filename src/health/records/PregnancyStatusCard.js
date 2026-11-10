// হোম ▸ প্রোফাইল ▸ "স্বাস্থ্য অবস্থা" (মকআপ ৪, ধাপ ৬) — গর্ভাবস্থা/বুকের দুধ একবার দিলে সব জায়গায় কাজ করে।
// শুধু নারী ১২–৫৫ বছর (বা আগে থেকে সক্রিয় রেকর্ড থাকলে)। চালু = সাথে সাথে; বন্ধ = ২-ধাপ নিশ্চিতকরণ (সুরক্ষা শিথিল হয় বলে)।
// লেখা → pregnancyData.js; পড়া → useMemberHealth। পুরনো ট্র্যাকার-টগল চালু থাকলে একবার রেকর্ডে তুলে আনে (কিছু মোছে না)।

import { useMemberHealth } from "./useMemberHealth.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { getGoal } from "../tracker/trackerData.js";
import { setPregnancyOn, setPregnancyOff } from "./pregnancyData.js";
import { ageYears, effectivePregnant, pregnancyRecordsOf } from "../tracker/trackerCalc.js";
import { T } from "../tracker/trackerTheme.js";
import { ErrorBox } from "../../shared/ui.js";

const { useState, useEffect, useRef } = React;
const h = React.createElement;
const ITEMS = ["ট্র্যাকার: ক্যালরি ও ওজন-লক্ষ্য নিরাপদ সীমায়", "খাবার: এড়িয়ে চলার তালিকা", "AI পরামর্শে জানানো হয়", "ডাক্তার-রিপোর্টে থাকে"];

export function PregnancyStatusCard({ familyId, selectedMemberId, callerMemberId }) {
  const { records } = useMemberHealth(familyId, selectedMemberId);
  const [member, setMember] = useState(undefined);
  const [goal, setGoal] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const migrating = useRef(false);

  useEffect(() => {
    let alive = true;
    setMember(undefined); setGoal(undefined); setErr(null); setConfirmOff(false); setMigrated(false); migrating.current = false;
    Promise.all([listMembers(familyId).catch(() => []), getGoal(familyId, selectedMemberId).catch(() => null)])
      .then(([ms, g]) => { if (alive) { setMember(ms.find((m) => m.id === selectedMemberId) || null); setGoal(g); } });
    return () => { alive = false; };
  }, [familyId, selectedMemberId]);

  const legacyOn = !!(goal && goal.flags && goal.flags.pregnant);
  const hasAnyRecord = records ? pregnancyRecordsOf(records).length > 0 : true;

  // পুরনো টগল → রেকর্ড (একবার; ব্যর্থ হলে চুপ — পুরনো টগল তখনও কার্যকর থাকে, কিছু হারায় না)
  useEffect(() => {
    if (!records || goal === undefined || !legacyOn || hasAnyRecord || migrating.current) return;
    migrating.current = true;
    setPregnancyOn(familyId, selectedMemberId, callerMemberId).then(() => setMigrated(true)).catch(() => { /* পরে আবার চেষ্টা হবে */ });
  }, [records, goal, legacyOn, hasAnyRecord, familyId, selectedMemberId, callerMemberId]);

  if (!records || member === undefined || goal === undefined) return null;
  const on = effectivePregnant(goal, records);
  const age = member ? ageYears(member.dob) : null;
  const eligible = member && member.sex === "female" && age !== null && age >= 12 && age <= 55;
  if (!eligible && !on) return null;

  const change = async (turnOn) => {
    setErr(null); setBusy(true);
    try { await (turnOn ? setPregnancyOn : setPregnancyOff)(familyId, selectedMemberId, callerMemberId); setConfirmOff(false); }
    catch (e) { setErr(e && e.code === "permission-denied" ? "এই সদস্যের তথ্য বদলানোর অনুমতি আপনার নেই।" : "সংরক্ষণ হয়নি — আবার চেষ্টা করুন।"); }
    finally { setBusy(false); }
  };

  const sw = h("button", {
    role: "switch", "aria-checked": on, "aria-label": "গর্ভাবস্থা বা বুকের দুধ খাওয়ানো", disabled: busy,
    onClick: () => (on ? setConfirmOff(true) : change(true)),
    style: { width: "56px", height: "32px", flexShrink: 0, borderRadius: "999px", border: "none", padding: "3px", cursor: busy ? "default" : "pointer", background: on ? T.green : "#D3CBB8", display: "flex", justifyContent: on ? "flex-end" : "flex-start", alignItems: "center" },
  }, h("span", { style: { width: "26px", height: "26px", borderRadius: "50%", background: "#fff", display: "block" } }));

  return h("div", { style: { marginBottom: "14px" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px 8px" } },
      h("div", { style: { fontSize: "17px", fontWeight: 700, color: T.green } }, "স্বাস্থ্য অবস্থা"), h("div", { style: { fontSize: "13px", color: T.muted } }, "একবার দিন")),
    h("div", { style: { background: T.surface, border: "1px solid " + T.border, borderRadius: "20px", padding: "12px 14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: "17px", fontWeight: 700, color: T.ink } }, "🤰 গর্ভাবস্থা / বুকের দুধ"),
          h("div", { style: { fontSize: "14px", color: T.muted } }, "নারী, ১২–৫৫ বছরে দেখা যায়")), sw),
      confirmOff && h("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "14px", background: "#FFF6DD", border: "1px solid #E8D08A", fontSize: "14px", color: "#7A5B00", lineHeight: 1.5 } },
        "গর্ভাবস্থা/বুকের দুধ খাওয়ানো শেষ হয়েছে? বন্ধ করলে ট্র্যাকার ও খাবারের সতর্কতা সাধারণ নিয়মে ফিরবে (রেকর্ড মোছা হবে না, অতীত ইতিহাসে থাকবে)।",
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
          h("button", { onClick: () => change(false), disabled: busy, style: { minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "none", background: T.green, color: "#fff", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" } }, "হ্যাঁ, বন্ধ করুন"),
          h("button", { onClick: () => setConfirmOff(false), disabled: busy, style: { minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "1.5px solid " + T.green, background: "none", color: T.green, fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" } }, "থাক")))),
    err && ErrorBox(err),
    on && h("div", { style: { background: "#E4F0E9", border: "1px solid #CFE0D6", borderRadius: "14px", padding: "10px 12px", marginTop: "8px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700, color: T.green, marginBottom: "4px" } }, "🔗 এটা যেখানে যেখানে কাজ করবে"),
      ITEMS.map((x) => h("div", { key: x, style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "✓ " + x))),
    migrated && h("div", { style: { background: "#FFF6DD", border: "1px solid #E8D08A", borderRadius: "14px", padding: "10px 12px", marginTop: "8px", fontSize: "14px", color: "#7A5B00", lineHeight: 1.5 } },
      "⚠️ ট্র্যাকারের আলাদা \"গর্ভবতী\" টগল আর লাগবে না — আগের মান এখানে নিয়ে আসা হয়েছে, কিছু মোছা হয়নি।"));
}
