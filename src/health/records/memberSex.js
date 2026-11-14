// সদস্যের লিঙ্গ ("male" | "female" | null) — ল্যাব-রেঞ্জ লিঙ্গভেদে বাছার জন্য। শুধু পড়ে; ব্যর্থ হলে null (বিস্তৃত রেঞ্জ ধরা হয়)।
import { listMembers } from "../../legacy/familyIdentity.js";

export async function fetchMemberSex(familyId, memberId) {
  try {
    const m = (await listMembers(familyId)).find((x) => x.id === memberId);
    return m && (m.sex === "male" || m.sex === "female") ? m.sex : null;
  } catch (e) {
    return null;
  }
}
