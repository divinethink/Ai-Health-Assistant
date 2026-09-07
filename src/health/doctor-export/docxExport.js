// DocumentExportEngine (Architecture Plan Part C §10.4) — DOCX অংশ। `docx` npm
// library (client-side, browser-compatible) দিয়ে সম্পূর্ণ generation browser-এ
// হয়, কোনো Firebase Cloud Function/backend লাগে না (Spark-only নীতি অক্ষুণ্ণ)।
// Font: Hind Siliguri (§10.6 Confirmed) — document-level default font হিসেবে সেট,
// রিডারের ডিভাইসে ইনস্টল না থাকলে Word/Google Docs নিজে থেকে system Bengali-font
// substitute করবে (ডেটা/লে-আউট অক্ষত থাকে, §10.6 নোট)।
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
import { describeHealthRecord } from "../records/healthRecordsData.js";

const FONT = "Hind Siliguri";

function heading(text, color) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, font: FONT, color: color || "0E4B43" })] });
}
function para(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, font: FONT, ...opts })] });
}
function simpleTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells) => new TableRow({
      children: cells.map((c) => new TableCell({ children: [para(c)], margins: { top: 60, bottom: 60, left: 80, right: 80 } })),
    })),
  });
}
async function downloadDocx(doc, filename) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtAge(m) {
  if (m.ageYears == null) return "?";
  return m.ageYears >= 2 ? Math.floor(m.ageYears) + " বছর" : Math.round(m.ageYears * 12) + " মাস";
}
function fmtDate(ms) {
  if (!ms) return "";
  const d = ms.toMillis ? new Date(ms.toMillis()) : new Date(ms);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

// §10.5 layout অনুযায়ী — DoctorExportPrintView.js (PDF/print path)-এর সাথে
// content-order অভিন্ন, শুধু rendering-target ভিন্ন (docx vs HTML/print)।
export async function exportHealthProfileDocx(data) {
  const m = data.member;
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Health Assistant — রোগী স্বাস্থ্য প্রোফাইল", bold: true, size: 32, font: FONT, color: "0E4B43" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "এটি একটি factual সারাংশ — কোনো AI মতামত/রোগনির্ণয় এখানে নেই", italics: true, size: 18, font: FONT, color: "666666" })] }),
    para("তৈরির তারিখ: " + fmtDate(data.generatedAt), { size: 18, color: "888888" }),
    heading("১. ব্যক্তিগত ও মৌলিক তথ্য"),
    simpleTable([
      ["নাম", m.name || "—"],
      ["বয়স", fmtAge(m) + (m.ageGroup ? " (" + m.ageGroup + ")" : "")],
      ["লিঙ্গ", m.sex || "—"],
      ["উচ্চতা / ওজন / BMI", (m.heightCm || "—") + " cm / " + (m.weightKg || "—") + " kg" + (m.bmi ? " / BMI " + m.bmi : "")],
      ["রক্তের গ্রুপ", m.bloodGroup || "—"],
    ]),
    heading("⚠ এলার্জি ও সতর্কতা", "C0392B"),
    ...(data.allergies.length === 0
      ? [para("কোনো জানা এলার্জি নেই।")]
      : data.allergies.map((a) => para("• " + describeHealthRecord(a)))),
  ];

  if (data.currentComplaint) {
    children.push(heading("২. বর্তমান সমস্যা", "7A5B00"));
    children.push(para((data.currentComplaint.chiefComplaintTag || "—") + (data.currentComplaint.createdAt ? " (" + fmtDate(data.currentComplaint.createdAt) + ")" : "")));
  }

  children.push(heading("৩. সক্রিয় স্বাস্থ্য সমস্যা"));
  children.push(...(data.activeConditions.length === 0 ? [para("কোনো সক্রিয় condition নেই।")] : [simpleTable(data.activeConditions.map((c) => [c.name, describeHealthRecord(c)]))]));

  children.push(heading("৪. বর্তমান ওষুধ"));
  children.push(...(data.currentMedications.length === 0 ? [para("কোনো বর্তমান ওষুধ নেই।")] : [simpleTable(data.currentMedications.map((med) => [med.genericName, describeHealthRecord(med)]))]));

  children.push(heading("৫. অতীত রোগের ইতিহাস (সমাধানকৃত)"));
  children.push(...(data.pastHistory.length === 0 ? [para("কোনো তথ্য নেই।")] : [simpleTable(data.pastHistory.map((c) => [c.name, describeHealthRecord(c)]))]));

  children.push(new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "এটি প্রেসক্রিপশন/রোগনির্ণয় নয় — শুধু পরিবার কর্তৃক সংরক্ষিত factual তথ্যের সারাংশ।", size: 16, font: FONT, color: "888888" })] }));

  const doc = new Document({ sections: [{ children }] });
  await downloadDocx(doc, `Health_Profile_${(m.name || "Member").replace(/\s+/g, "_")}.docx`);
}

// §10.3/§10.5 — একই visual-language, শুধু allergy-বক্সের জায়গায় amber
// "AI Health Guidance — Not a Medical Prescription" বক্স (§10.5 নোট)।
export async function exportAiHealthSummaryDocx(data) {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Health Assistant — AI Health Summary", bold: true, size: 32, font: FONT, color: "0E4B43" })] }),
    para("তৈরির তারিখ: " + fmtDate(data.generatedAt), { size: 18, color: "888888" }),
    para("সদস্য: " + (data.memberName || "—")),
    heading("AI Health Guidance — Not a Medical Prescription", "7A5B00"),
    para("প্রধান সমস্যা: " + (data.chiefComplaintTag || "—") + (data.episodeCreatedAt ? " (" + fmtDate(data.episodeCreatedAt) + ")" : "")),
    para("Risk Level: " + (data.riskLevel || "—")),
    ...(data.recommendedAction
      ? [para("পরামর্শ: " + (data.recommendedAction.action || "—") + (data.recommendedAction.timeframe ? " — " + data.recommendedAction.timeframe : ""))]
      : []),
    heading("বিস্তারিত AI Guidance"),
    ...data.guidanceText.split("\n").map((line) => para(line || " ")),
    new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "এটি প্রেসক্রিপশন/রোগনির্ণয় নয় — AI-generated guidance, চূড়ান্ত সিদ্ধান্তের জন্য ডাক্তারের পরামর্শ নিন।", size: 16, font: FONT, color: "888888" })] }),
  ];
  const doc = new Document({ sections: [{ children }] });
  await downloadDocx(doc, `AI_Health_Summary_${(data.memberName || "Member").replace(/\s+/g, "_")}.docx`);
}
