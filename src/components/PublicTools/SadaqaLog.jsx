// SadaqaLog.jsx — "সহায়িকা"→"ইসলামি টুলস ও ট্র্যাকিং", item ২৮ (3_1 Phase D)।
// Personal per-device log(localStorage, publicToolsSadaqa.js data-layer) — কোনো
// checklist/family-Firestore না (3_1 Core Decision-এর বাইরে, কারণ এটা Home
// Dashboard-এর কোনো ফিল্ডের সাথে duplicate না)।
// React global(window.React, globals.js)।

import { toBn, dateKey } from "../../legacy/appHelpers.js";
import { getSadaqaLog, addSadaqaEntry, deleteSadaqaEntry } from "../../legacy/publicToolsSadaqa.js";
import { Trash } from "../icons.jsx";

const { useState } = React;

function todayStr() {
  return dateKey(new Date()); // স্থানীয় তারিখ (UTC নয়)
}

function formatTaka(n) {
  return toBn(Math.round(n).toLocaleString("en-US"));
}

function formatDateBn(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return toBn(`${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`);
}

export function SadaqaLog() {
  const [entries, setEntries] = useState(() => getSadaqaLog());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => todayStr());

  const total = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  function handleAdd() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const updated = addSadaqaEntry({ amount: n, note, date });
    setEntries(updated);
    setAmount("");
    setNote("");
  }

  function handleDelete(id) {
    setEntries(deleteSadaqaEntry(id));
  }

  return /*#__PURE__*/React.createElement(
    "div",
    { className: "px-4 pb-6 flex flex-col gap-4" },
    /*#__PURE__*/React.createElement(
      "div",
      { className: "bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-col gap-3" },
      /*#__PURE__*/React.createElement(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        /*#__PURE__*/React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          /*#__PURE__*/React.createElement("label", { className: "text-xs text-slate-600" }, "পরিমাণ (৳)"),
          /*#__PURE__*/React.createElement("input", {
            type: "number",
            min: "0",
            inputMode: "decimal",
            value: amount,
            onChange: (e) => setAmount(e.target.value),
            className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700",
          })
        ),
        /*#__PURE__*/React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          /*#__PURE__*/React.createElement("label", { className: "text-xs text-slate-600" }, "তারিখ"),
          /*#__PURE__*/React.createElement("input", {
            type: "date",
            value: date,
            onChange: (e) => setDate(e.target.value),
            className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700",
          })
        )
      ),
      /*#__PURE__*/React.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        /*#__PURE__*/React.createElement("label", { className: "text-xs text-slate-600" }, "নোট (ঐচ্ছিক)"),
        /*#__PURE__*/React.createElement("input", {
          type: "text",
          value: note,
          placeholder: "যেমন: এতিমখানায় দান",
          onChange: (e) => setNote(e.target.value),
          className: "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-700",
        })
      ),
      /*#__PURE__*/React.createElement(
        "button",
        {
          type: "button",
          onClick: handleAdd,
          className: "mt-1 w-full py-3 rounded-xl text-white font-semibold text-sm",
          style: { background: "var(--theme-primary, #0E4B43)" },
        },
        "+ যোগ করুন"
      )
    ),
    /*#__PURE__*/React.createElement(
      "div",
      { className: "flex items-center justify-between px-1" },
      /*#__PURE__*/React.createElement("span", { className: "text-sm font-semibold text-emerald-950" }, "মোট সদকা"),
      /*#__PURE__*/React.createElement(
        "span",
        { className: "text-lg font-bold", style: { fontFamily: "'Hind Siliguri', sans-serif", color: "var(--theme-primary, #0E4B43)" } },
        "৳" + formatTaka(total)
      )
    ),
    entries.length === 0
      ? /*#__PURE__*/React.createElement("p", { className: "text-sm text-slate-400 text-center py-6" }, "এখনো কোনো এন্ট্রি নেই")
      : /*#__PURE__*/React.createElement(
          "div",
          { className: "bg-white rounded-2xl shadow-sm border border-slate-200/80 divide-y divide-slate-100" },
          entries.map((e) =>
            /*#__PURE__*/React.createElement(
              "div",
              { key: e.id, className: "px-4 py-3 flex items-center justify-between gap-2" },
              /*#__PURE__*/React.createElement(
                "div",
                { className: "min-w-0" },
                /*#__PURE__*/React.createElement(
                  "div",
                  { className: "text-sm font-semibold text-emerald-950", style: { fontFamily: "'Hind Siliguri', sans-serif" } },
                  "৳" + formatTaka(e.amount)
                ),
                /*#__PURE__*/React.createElement(
                  "div",
                  { className: "text-xs text-slate-500 truncate" },
                  formatDateBn(e.date) + (e.note ? " · " + e.note : "")
                )
              ),
              /*#__PURE__*/React.createElement(
                "button",
                { type: "button", onClick: () => handleDelete(e.id), className: "p-1.5 text-slate-400 hover:text-red-600 shrink-0" },
                /*#__PURE__*/React.createElement(Trash, { size: 16 })
              )
            )
          )
        )
  );
}
