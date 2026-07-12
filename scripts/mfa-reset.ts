/* Operator lockout recovery: `npm run mfa:reset -- <username>`
   Turns off two-step verification for one account so the user can sign in
   with their password and re-enroll. Runs on the server (needs DATABASE_URL);
   the reset is recorded in the audit log. */
import { eq } from "drizzle-orm";
import { db, t, dbReady } from "../src/db";

async function main(): Promise<void> {
  const username = (process.argv[2] ?? "").trim().toLowerCase();
  if (!username) {
    console.error("Usage: npm run mfa:reset -- <username>");
    process.exit(1);
  }
  await dbReady();
  const user = (await db.select().from(t.users).where(eq(t.users.username, username)))[0];
  if (!user) {
    console.error(`No account with username "${username}".`);
    process.exit(1);
  }
  if (user.totpEnabled !== 1) {
    console.log(`Two-step verification is not on for ${username} — nothing to reset.`);
    process.exit(0);
  }
  await db.update(t.users)
    .set({ totpEnabled: 0, totpSecret: null, recoveryCodes: [] })
    .where(eq(t.users.id, user.id));
  // sign out every session for the account — the person holding the password
  // must sign in fresh (and should re-enroll immediately)
  await db.delete(t.sessions).where(eq(t.sessions.userId, user.id));
  await db.insert(t.auditLog).values({
    at: new Date().toISOString(),
    userId: null,
    action: "auth.mfa-reset",
    entity: "user",
    entityId: user.id,
    detail: `Two-step verification reset from the server console for ${username}; all sessions revoked`,
  });
  console.log(`Two-step verification reset for ${username}. All their sessions were signed out.`);
  console.log("Have them sign in with their password and re-enroll right away.");
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
