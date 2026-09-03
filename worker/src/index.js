// Document/Report vault (Roadmap §7) — Cloudinary upload-signature + delete proxy।
//
// কেন এই Worker দরকার: Cloudinary API secret কখনো client bundle-এ যেতে পারবে না
// (Process Rule ৪)। কিন্তু permission-decision (কে কোন memberId-এর জন্য upload/
// delete করতে পারবে) আমরা এখানে ডুপ্লিকেট করিনি — সেটা সম্পূর্ণভাবে ইতিমধ্যে
// deployed `firestore.rules`-এর hasAccess()/hasDeleteAccess()-কেই একমাত্র
// source-of-truth রাখা হয়েছে। পদ্ধতি: caller-এর Firebase ID token দিয়ে
// সরাসরি Firestore REST API-কে সেই নির্দিষ্ট document-এ GET/DELETE request
// পাঠানো হয় — Firestore নিজেই rules অনুযায়ী allow/deny করে; Worker শুধু সেই
// ফলাফল (success/fail) দেখে Cloudinary-action চালায় কিনা ঠিক করে। এতে দুই
// জায়গায় (rules ফাইল + Worker কোড) একই permission-logic লিখে sync-ভুলের
// ঝুঁকি — যেটা storage.rules approach-এ ছিল — সম্পূর্ণ এড়ানো গেছে।
//
// Endpoints:
//   POST /upload-auth  { idToken, familyId, docId } -> { cloudName, apiKey, timestamp, signature, publicId, folder }
//   POST /delete        { idToken, familyId, docId } -> { ok: true }
//
// নিরাপত্তা মডেল (owner-কে transparently জানানো, Process Rule ৪): Cloudinary
// delivery type "upload" (default) ব্যবহার হচ্ছে — অর্থাৎ চূড়ান্ত `secure_url`
// জানা থাকলে সরাসরি খোলা যায় (URL নিজেই দীর্ঘ/random public_id-ভিত্তিক বলে
// guess করা কার্যত অসম্ভব, কিন্তু cryptographic access-control না)। এই URL
// শুধু আমাদের নিজস্ব access-controlled Firestore document-এর ভেতরেই থাকে,
// তাই "কে URL পায়" সম্পূর্ণভাবে hasAccess()-দিয়েই নিয়ন্ত্রিত — URL পাওয়ার পর
// সেটা অন্য কাউকে ইচ্ছাকৃতভাবে forward করলে (যেমন screenshot/copy-paste) সেই
// ঝুঁকি প্রায় সব consumer-app-এই সাধারণভাবে থাকে (Firestore-base64 approach-
// এও একই প্রকৃতির সীমাবদ্ধতা ছিল)।

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function firestoreDocUrl(env, path) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

function fsFieldsToPlain(fields) {
  const out = {};
  for (const k in fields || {}) {
    const v = fields[k];
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
  }
  return out;
}

async function sha1Hex(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env) });
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/upload-auth") {
        const { idToken, familyId, docId } = await request.json();
        if (!idToken || !familyId || !docId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/documents/${docId}`;
        // এই GET-ই একমাত্র permission-check — Firestore rules-এর hasAccess()
        // pass না করলে এখানেই non-200 আসবে।
        const getRes = await fetch(firestoreDocUrl(env, docPath), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!getRes.ok) return json(env, { error: "forbidden" }, 403);

        const timestamp = Math.floor(Date.now() / 1000);
        const folder = `health-docs/${familyId}`;
        const publicId = docId;
        // Cloudinary signed-upload নিয়ম: sign করা হয় file/api_key/signature/
        // cloud_name/resource_type বাদে বাকি সব param, key-alphabetical-sorted।
        const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
        const signature = await sha1Hex(toSign);

        return json(env, {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          timestamp, signature, publicId, folder,
        });
      }

      if (request.method === "POST" && url.pathname === "/delete") {
        const { idToken, familyId, docId } = await request.json();
        if (!idToken || !familyId || !docId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/documents/${docId}`;
        const docUrl = firestoreDocUrl(env, docPath);

        // ধাপ ১: doc read করে cloudinaryPublicId/resourceType বের করা (hasAccess()-গেটেড)।
        const getRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${idToken}` } });
        if (!getRes.ok) return json(env, { error: "not-found-or-forbidden" }, 404);
        const doc = await getRes.json();
        const fields = fsFieldsToPlain(doc.fields);
        const publicId = fields.cloudinaryPublicId || docId;
        const resourceType = fields.cloudinaryResourceType || "image";

        // ধাপ ২: আসল delete — এখানেই hasDeleteAccess() (read-এর চেয়ে কড়া) verify
        // হয়। এটা fail করলে Cloudinary-তে কিছু মোছা হবে না (fail-safe)।
        const delRes = await fetch(docUrl, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
        if (!delRes.ok) return json(env, { error: "forbidden" }, 403);

        // ধাপ ৩: উপরের ধাপ pass করলে তবেই Cloudinary asset মোছা হয় (admin-secret,
        // trusted server-call, per-request user-permission Worker আগেই verify করেছে)।
        const basicAuth = "Basic " + btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
        const cloudDelUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload?public_ids[]=${encodeURIComponent(publicId)}`;
        await fetch(cloudDelUrl, { method: "DELETE", headers: { Authorization: basicAuth } });

        return json(env, { ok: true });
      }

      return json(env, { error: "not-found" }, 404);
    } catch (e) {
      return json(env, { error: (e && e.message) || String(e) }, 500);
    }
  },
};
