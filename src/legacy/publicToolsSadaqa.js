// publicToolsSadaqa.js — সদকা লগ (3_1 Phase D item ২৮)। Pure per-device localStorage
// array(3_2 §৩ key: dt_pt_sadaqa_log), কোনো Firestore/family-data touch করে না।
// data/ layer(Dev Rule ২): এই ফাইল শুধু CRUD করে, কোনো UI/JSX নেই।

import { dateKey } from "./appHelpers.js";

const SADAQA_LOG_KEY = "dt_pt_sadaqa_log";

function getSadaqaLog() {
  try {
    const raw = localStorage.getItem(SADAQA_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSadaqaLog(entries) {
  try {
    localStorage.setItem(SADAQA_LOG_KEY, JSON.stringify(entries));
  } catch {}
}

function addSadaqaEntry({ amount, note, date }) {
  const entries = getSadaqaLog();
  const entry = {
    id: `sdq_${Date.now()}`,
    amount: Number(amount) || 0,
    note: note || "",
    date: date || dateKey(new Date()),
    createdAt: Date.now(),
  };
  const updated = [entry, ...entries];
  saveSadaqaLog(updated);
  return updated;
}

function deleteSadaqaEntry(id) {
  const updated = getSadaqaLog().filter((e) => e.id !== id);
  saveSadaqaLog(updated);
  return updated;
}

export { getSadaqaLog, addSadaqaEntry, deleteSadaqaEntry };
