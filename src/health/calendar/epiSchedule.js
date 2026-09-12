// Bangladesh EPI (Expanded Programme on Immunization) schedule — DGHS/WHO
// standard, public reference (roadmap §6.3.1 *.gov.bd-এর সাথে সংগতিপূর্ণ)।
// এটা medicineDatabase-এর মতো pharmacist/physician batch-review-প্রয়োজনীয়
// "draft" dosing-data না — জাতীয় সরকারি স্থির vaccination-schedule, তাই সরাসরি
// static client-side constant হিসেবে রাখা হলো (owner-request, ২০২৬-০৯-১২, item ৪)।

export const EPI_SCHEDULE = [
  { doseId: "bcg", name: "BCG", ageWeeks: 0 },
  { doseId: "opv0", name: "OPV-0", ageWeeks: 0 },
  { doseId: "penta1", name: "Pentavalent-1 + OPV1 + PCV1", ageWeeks: 6 },
  { doseId: "penta2", name: "Pentavalent-2 + OPV2 + PCV2", ageWeeks: 10 },
  { doseId: "penta3", name: "Pentavalent-3 + OPV3 + PCV3 + IPV", ageWeeks: 14 },
  { doseId: "mr1", name: "Measles-Rubella (MR)-1", ageWeeks: 39 }, // ~৯ মাস
  { doseId: "mr2", name: "Measles-Rubella (MR)-2", ageWeeks: 65 }, // ~১৫ মাস
];

// dob (YYYY-MM-DD) থেকে প্রতিটা dose-এর প্রত্যাশিত তারিখ হিসাব — pure client-side
// গণনা, কোনো Firestore read লাগে না।
export function computeVaccinationDueDates(dobStr) {
  if (!dobStr) return [];
  const dob = new Date(dobStr + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return [];
  return EPI_SCHEDULE.map((d) => {
    const due = new Date(dob.getTime() + d.ageWeeks * 7 * 24 * 60 * 60 * 1000);
    return { ...d, dueDate: due.toISOString().slice(0, 10) };
  });
}
