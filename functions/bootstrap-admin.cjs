// Run locally with trusted Application Default Credentials; never bundle this.
const admin = require("firebase-admin");

async function main() {
  const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Set server-only SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  let user;
  try { user = await admin.auth().getUserByEmail(SUPER_ADMIN_EMAIL); }
  catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await admin.auth().createUser({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD });
  }
  await admin.auth().setCustomUserClaims(user.uid, { ...user.customClaims, role: "authenticated" });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?on_conflict=id`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: user.uid, email: SUPER_ADMIN_EMAIL,
      name: process.env.SUPER_ADMIN_NAME || "Super Administrator", role: "super_admin", status: "active" }),
  });
  if (!response.ok) throw new Error(`Profile provisioning failed (HTTP ${response.status}).`);
  console.log("Administrator profile provisioned. Existing Firebase passwords were preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
