import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { JURISDICTIONS } from "@/lib/fpl-data";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up · CAP Trellis" };

// queries live install state (users table) — never prerender; the build's
// throwaway in-memory database must not bake this page's data
export const dynamic = "force-dynamic";

/* First-run setup wizard — reachable ONLY while the install has no users.
   The moment the first administrator exists this page hard-redirects to
   /login (and the server action re-checks the same invariant). */
export default async function SetupPage() {
  const users = await db.select({ id: t.users.id }).from(t.users);
  if (users.length > 0) redirect("/login");

  const org = (await db.select().from(t.organization))[0];
  return (
    <SetupForm
      defaults={{
        name: org?.name === "New Community Action Agency" ? "" : (org?.name ?? ""),
        short: org?.short === "CAA" ? "" : (org?.short ?? ""),
        region: org?.region ?? "",
        jurisdiction: org?.jurisdiction ?? "contiguous48",
        csbgCeiling: org?.csbgCeiling ?? 125,
        incomeLookbackDays: org?.incomeLookbackDays ?? 90,
      }}
      jurisdictions={JURISDICTIONS.map((j) => ({ id: j.id, label: j.label }))}
    />
  );
}
