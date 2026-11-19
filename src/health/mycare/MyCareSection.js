// MyCare (ব্যক্তিগত যত্ন) — ধাপ ৪: UI। বয়স/লিঙ্গ/অ্যালার্জি/রোগ/গর্ভাবস্থা অ্যাপ থেকেই পড়া হয় (আবার জিজ্ঞেস নয়)।
// পরামর্শ আসে careEngine থেকে; "অন্যের জন্য" তথ্য শুধু এই কম্পোনেন্টের state-এ (মেমরি)। পরিকল্পনা: MyCare_Plan.md §৪–৬।
import { L, useLang, digits } from "../../shared/i18n.js";
import { Skeleton, ErrorBox } from "../../shared/ui.js";
import { histBind, histChange } from "../../shared/navHistory.js";
import { useMemberHealth } from "../records/useMemberHealth.js";
import { getCarePrefs, saveCarePrefs, saveSavedIds } from "./carePrefsData.js";
import { sanitizeCarePrefs, toggleSaved } from "./carePrefsSchema.js";
import { recommend } from "./careEngine.js";
import { seasonOf } from "./careSeason.js";
import { buildOwnProfile, buildOtherProfile, prefsProgress } from "./careAdapter.js";
import { ALL_ITEMS } from "./data/index.js";
import { CAT_META, CAT_DESC, LABELS, AGE_BANDS, SEASON_LABEL } from "./careLabels.js";
import { IconBox } from "./careIcons.js";
import { TodayCareView, CareWeekCard } from "./TodayCareCard.js";
import { useCareLog } from "./useCareLog.js";
import { usePatches } from "./carePatchStore.js";
import { PatchCheckCard } from "./PatchCheckCard.js";
import { MyCareCategory } from "./MyCareCategory.js";
import { CareProfileSheet, OtherSheet } from "./CareProfileSheets.js";

const { useState, useEffect } = React;
const VIEW_KEY = "mycare-view";
const card = { padding: "14px", borderRadius: "16px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 8px rgba(14,75,67,0.07)", marginBottom: "12px" };
const warnBox = { padding: "10px 12px", borderRadius: "12px", background: "#FFF6DD", border: "1px solid #E8D08A", color: "#7A5B00", fontSize: "13.5px", lineHeight: 1.5, marginBottom: "12px" };
const heroBtn = { minHeight: "44px", padding: "6px 16px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: "13.5px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
const T = (o) => (o ? L(o.bn, o.en) : "");

export function MyCareSection({ chip, familyId, callerMemberId, selectedMemberId, members, onAskAI }) {
  useLang();
  const [view, setView] = useState("home");
  const [sheet, setSheet] = useState(null); // "profile" | "other" | null
  const [other, setOther] = useState(null); // অন্যের জন্য ফর্ম — শুধু মেমরি
  const [pf, setPf] = useState({ loading: true, prefs: null, error: false });
  const health = useMemberHealth(familyId, selectedMemberId);
  const careLog = useCareLog(familyId, selectedMemberId, callerMemberId);
  const patches = usePatches(selectedMemberId);
  histBind(VIEW_KEY, view, setView);

  // সদস্য বদলালে: অস্থায়ী মোড ও খোলা বিভাগ রিসেট
  useEffect(() => { setOther(null); setView("home"); setSheet(null); }, [selectedMemberId]);

  useEffect(() => {
    if (!familyId || !selectedMemberId) { setPf({ loading: false, prefs: null, error: false }); return undefined; }
    let alive = true;
    setPf({ loading: true, prefs: null, error: false });
    getCarePrefs(familyId, selectedMemberId)
      .then((prefs) => { if (alive) setPf({ loading: false, prefs, error: false }); })
      .catch(() => { if (alive) setPf({ loading: false, prefs: null, error: true }); });
    return () => { alive = false; };
  }, [familyId, selectedMemberId]);

  const member = (members || []).find((m) => m.id === selectedMemberId) || null;
  const wrap = (...kids) => React.createElement("div", { style: { padding: "8px 12px 76px", color: "var(--hs-text)" } }, ...kids);
  const title = React.createElement("h2", { style: { fontSize: "22px", margin: "8px 0 2px", color: "var(--hs-primary)" } }, "MyCare");

  if (members === null || !member || health.loading || pf.loading) {
    return wrap(React.createElement("div", { style: { display: "flex", marginBottom: "4px" } }, chip), title, Skeleton(4, 72));
  }

  const recordsOk = !health.error && Array.isArray(health.records);
  const profile = other ? buildOtherProfile(other) : buildOwnProfile({ member, records: health.records, recordsOk, prefs: pf.prefs });
  const season = seasonOf(new Date());
  const overview = recommend(profile, ALL_ITEMS, { season });
  const warnLines = [
    ...overview.notices.map(T),
    overview.hidden.allergy > 0 ? L("অ্যালার্জি/এড়াতে-চাওয়া উপাদানের কারণে কিছু আইটেম লুকানো।", "Some items are hidden because of allergies or ingredients to avoid.") : "",
    overview.hidden.group > 0 ? L("বয়স/গর্ভাবস্থা/স্বাস্থ্য-অবস্থার কারণে কিছু আইটেম লুকানো।", "Some items are hidden because of age, pregnancy or health conditions.") : "",
  ].filter(Boolean);

  const openCat = (id) => histChange(VIEW_KEY, view, id, setView);
  const back = () => { try { window.history.back(); } catch (e) { setView("home"); } };
  const editProfile = () => setSheet(other ? "other" : "profile");
  const savePrefs = async (form) => {
    await saveCarePrefs(familyId, selectedMemberId, callerMemberId, form, pf.prefs != null);
    setPf((s) => ({ ...s, prefs: { ...sanitizeCarePrefs(form), savedIds: (s.prefs && s.prefs.savedIds) || [] } }));
  };

  const saved = (!other && pf.prefs && pf.prefs.savedIds) || [];
  // সংরক্ষণ: আগে স্ক্রিনে বদল, ব্যর্থ হলে আগের অবস্থায় ফেরা। ফল: null | "full" | "error"
  const toggleSave = async (id) => {
    const r = toggleSaved(saved, id);
    if (r.full) return "full";
    const prev = pf.prefs;
    setPf((s) => ({ ...s, prefs: { ...(s.prefs || sanitizeCarePrefs(null)), savedIds: r.ids } }));
    try { await saveSavedIds(familyId, selectedMemberId, callerMemberId, r.ids, prev != null); return null; }
    catch (e) { setPf((s) => ({ ...s, prefs: prev })); return "error"; }
  };

  const sheets = [
    sheet === "profile" && React.createElement(CareProfileSheet, { key: "p", prefs: pf.prefs, sex: profile.sex, onSave: savePrefs, onClose: () => setSheet(null) }),
    sheet === "other" && React.createElement(OtherSheet, { key: "o", initial: other, onApply: setOther, onClose: () => setSheet(null) }),
  ];

  if (view !== "home" && (view === "saved" || CAT_META.some((c) => c[0] === view))) {
    return wrap(React.createElement(MyCareCategory, { key: view + (other ? "-o" : ""), catId: view, profile, season, familyId, canExplain: !other, onAskAI: other ? null : onAskAI, patch: other ? null : patches, savedIds: other ? null : saved, onToggleSave: other ? null : toggleSave, onBack: back, onEditProfile: editProfile }), sheets);
  }

  const ageTxt = profile.ageYears == null ? "—" : digits(Math.floor(profile.ageYears)) + L(" বছর", " yrs");
  const sexTxt = profile.sex ? T(LABELS.sex[profile.sex]) : "—";
  const band = other && AGE_BANDS.find((b) => b[0] === other.ageBand);
  const who = other ? (band ? L(band[1], band[2]) : "") + " · " + sexTxt : (member.name || "") + " · " + ageTxt + " · " + sexTxt;
  const prog = prefsProgress(pf.prefs);

  return wrap(
    React.createElement("div", { style: { display: "flex", marginBottom: "8px" } }, chip),
    React.createElement("div", { style: { padding: "16px", borderRadius: "22px", background: "linear-gradient(135deg, #0E4B43 0%, #1F7A5C 100%)", color: "#fff", boxShadow: "0 8px 22px rgba(14,75,67,0.28)", marginBottom: "14px" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
        React.createElement("h2", { style: { fontSize: "24px", fontWeight: 800, margin: 0, color: "#fff" } }, "MyCare"),
        SEASON_LABEL[season] && React.createElement("span", { style: { fontSize: "12.5px", fontWeight: 700, padding: "4px 12px", borderRadius: "999px", background: "rgba(255,255,255,0.18)", whiteSpace: "nowrap" } }, L("ঋতু: ", "Season: ") + L(SEASON_LABEL[season][0], SEASON_LABEL[season][1]))),
      React.createElement("p", { style: { fontSize: "13.5px", opacity: 0.88, margin: "4px 0 12px" } }, L("প্রমাণভিত্তিক ব্যক্তিগত যত্নের গাইড", "Evidence-based personal care guide")),
      React.createElement("div", { style: { borderTop: "1px solid rgba(255,255,255,0.22)", paddingTop: "10px" } },
        React.createElement("div", { style: { fontSize: "12.5px", opacity: 0.8 } }, other ? L("এখন দেখছেন — অন্য একজন", "Viewing — someone else") : L("যার জন্য দেখছেন", "Viewing for")),
        React.createElement("div", { style: { fontSize: "17px", fontWeight: 800, margin: "2px 0 10px", overflowWrap: "anywhere" } }, who),
        React.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          other
            ? [React.createElement("button", { key: "e", type: "button", style: heroBtn, onClick: () => setSheet("other") }, L("তথ্য বদলান", "Edit")),
              React.createElement("button", { key: "b", type: "button", style: heroBtn, onClick: () => setOther(null) }, L("নিজের তথ্যে ফিরুন", "Back to my details"))]
            : React.createElement("button", { type: "button", style: heroBtn, onClick: () => setSheet("other") }, L("অন্যের জন্য দেখুন", "View for someone else"))))),
    other && React.createElement("div", { style: warnBox }, L("অস্থায়ী — সংরক্ষিত হয় না।", "Temporary — not saved.")),
    !other && !recordsOk && React.createElement("div", null, ErrorBox(L("স্বাস্থ্য-রেকর্ড পড়া যায়নি, তাই শুধু সবচেয়ে নিরাপদ সাধারণ পরামর্শ দেখানো হবে।", "Could not read health records, so only the safest basic advice is shown."))),
    warnLines.length > 0 && React.createElement("div", { style: warnBox, role: "status" }, warnLines.map((w, i) => React.createElement("div", { key: i }, "⚠ " + w))),
    !other && React.createElement(PatchCheckCard, { list: patches.list, update: patches.update }),
    overview.mode !== "referral" && React.createElement(TodayCareView, { profile, log: other ? null : careLog, onOpen: (it) => { if (it) openCat(it.category); } }),
    overview.mode !== "referral" && !other && React.createElement(CareWeekCard, { log: careLog }),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: "14px" } },
      CAT_META.map(([id, bn, en, color]) => {
        const ready = ALL_ITEMS.some((i) => i.category === id && i.status === "verified");
        const inner = [
          React.createElement(IconBox, { key: "i", id, color, size: 44 }),
          React.createElement("span", { key: "t", style: { display: "block", marginTop: "10px" } },
            React.createElement("span", { style: { display: "block", fontSize: "16px", fontWeight: 800, color: "var(--hs-text)" } }, L(bn, en)),
            React.createElement("span", { style: { display: "block", fontSize: "12.5px", lineHeight: 1.4, marginTop: "2px", color: "var(--hs-muted)" } }, CAT_DESC[id] ? L(CAT_DESC[id][0], CAT_DESC[id][1]) : "")),
          !ready && React.createElement("span", { key: "s", style: { position: "absolute", top: "10px", right: "10px", fontSize: "11.5px", padding: "2px 8px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-muted)" } }, L("শীঘ্রই", "Soon")),
        ];
        const st = { position: "relative", minHeight: "128px", padding: "14px", borderRadius: "20px", border: "1px solid var(--hs-border)", borderTop: "3px solid " + color, background: "var(--hs-surface)", boxShadow: "0 4px 14px rgba(14,75,67,0.08)", display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "left", fontFamily: "inherit", opacity: ready ? 1 : 0.7, cursor: ready ? "pointer" : "default" };
        return React.createElement("button", { key: id, type: "button", disabled: !ready, "aria-disabled": !ready, onClick: () => openCat(id), style: st }, inner);
      })),
    saved.length > 0 && React.createElement("button", { type: "button", onClick: () => openCat("saved"), style: { ...card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--hs-text)", display: "flex", alignItems: "center", gap: "12px", boxSizing: "border-box" } },
      React.createElement(IconBox, { id: "saved", color: "#B8860B", size: 40 }),
      React.createElement("span", { style: { flex: 1, fontSize: "16px", fontWeight: 800 } }, L("সংরক্ষিত পরামর্শ", "Saved advice")),
      React.createElement("span", { style: { fontSize: "13px", fontWeight: 800, padding: "2px 10px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-primary)" } }, digits(saved.length)),
      React.createElement("span", { "aria-hidden": "true", style: { fontSize: "20px", color: "var(--hs-muted)" } }, "›")),
    !other && React.createElement("button", { type: "button", onClick: () => setSheet("profile"), style: { ...card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--hs-text)", display: "block", boxSizing: "border-box" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
        React.createElement("span", { style: { fontSize: "16px", fontWeight: 800 } }, "My Care Profile"),
        React.createElement("span", { style: { fontSize: "12.5px", fontWeight: 800, padding: "2px 10px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-primary)" } }, prog.complete ? L("সম্পূর্ণ", "Complete") : L("সম্পূর্ণ করুন", "Complete it"))),
      React.createElement("div", { "aria-hidden": "true", style: { height: "8px", borderRadius: "4px", background: "var(--hs-chip-bg, #E4F0E9)", margin: "10px 0 6px", overflow: "hidden" } },
        React.createElement("div", { style: { width: prog.percent + "%", height: "100%", background: "linear-gradient(90deg, #1F7A5C, #0E4B43)", borderRadius: "4px" } })),
      React.createElement("div", { style: { fontSize: "12.5px", color: "var(--hs-muted)" } }, pf.error ? L("প্রোফাইল পড়া যায়নি — পরে আবার চেষ্টা করুন।", "Could not read profile — try again later.") : L("ত্বক ও চুলের তথ্য দিলে পরামর্শ আরও মানানসই হয়", "Skin & hair details help tailor advice"))),
    React.createElement("p", { style: { fontSize: "12.5px", color: "var(--hs-muted)", lineHeight: 1.5, margin: 0 } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice.")),
    sheets);
}
