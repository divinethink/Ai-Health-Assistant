// medicineDatabase-এর draft → verified পরিকল্পনা (pure: Firebase/ফাইল নেই; টেস্টযোগ্য)।
// docs = [{ id, data }]। opts = { names: string[], all: boolean, role, date, today }।
const ROLES = ["pharmacist", "physician"];
const norm = (v) => String(v || "").trim().toLowerCase();

export function validateOpts({ role, date, today, names, all }) {
  if (!ROLES.includes(role)) return "--role লাগবে: pharmacist বা physician";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "--date লাগবে YYYY-MM-DD আকারে (যেমন 2026-11-16)";
  if (today && date > today) return "--date ভবিষ্যতের হতে পারে না";
  if (!all && !(names && names.length)) return "--names \"A,B\" দিন, অথবা সব draft-এর জন্য --all";
  if (all && names && names.length) return "--all ও --names একসাথে নয়";
  return null;
}

export function planVerification(docs, opts) {
  const wanted = new Set((opts.names || []).map(norm));
  const toVerify = [], skipped = [], matched = new Set();
  for (const { id, data } of docs) {
    const g = norm(data.genericName);
    const hit = opts.all || wanted.has(g) || wanted.has(norm(id));
    if (!hit) continue;
    if (wanted.has(g)) matched.add(g);
    if (wanted.has(norm(id))) matched.add(norm(id));
    if (data.status === "verified") { skipped.push({ id, reason: "আগে থেকেই verified" }); continue; }
    if (data.status !== "draft") { skipped.push({ id, reason: "status draft নয় (" + data.status + ")" }); continue; }
    // জরুরি bystander Aspirin: শুধু physician-এর verify (Architecture B৫)
    if (g.startsWith("aspirin") && opts.role !== "physician") { skipped.push({ id, reason: "Aspirin (bystander) শুধু --role physician দিয়ে" }); continue; }
    toVerify.push({ id, genericName: data.genericName, tier: data.tier });
  }
  const unmatched = [...wanted].filter((n) => !matched.has(n));
  return { toVerify, skipped, unmatched };
}
