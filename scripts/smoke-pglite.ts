/* Smoke test: run the production bootstrap DDL + seed against an in-process
   PGlite (real Postgres compiled to WASM), then sample the queries the app
   leans on. Verifies the Postgres port without needing a server: `npm run smoke` */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { BOOTSTRAP } from "../src/db/ddl";
import { runSeed } from "../src/db/seed";

const t = schema;
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const pglite = new PGlite();
  await pglite.exec(BOOTSTRAP);
  await pglite.exec(BOOTSTRAP); // idempotency: second boot over an existing schema must not throw
  const db = drizzle(pglite, { schema }) as unknown as NodePgDatabase<typeof schema>;

  await runSeed(db);

  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0];
  check("organization seeded", org?.name === "Community Action Lehigh Valley");

  const users = await db.select().from(t.users);
  check("six demo users", users.length === 6, `got ${users.length}`);

  const clients = await db.select().from(t.clients);
  check("clients seeded", clients.length > 0, `got ${clients.length}`);
  check("client jsonb flags is an array", Array.isArray(clients[0]?.flags));
  check("client jsonb custom is an object", typeof clients[0]?.custom === "object" && !Array.isArray(clients[0]?.custom));

  const apps = await db.select().from(t.applications);
  check("applications seeded", apps.length > 0, `got ${apps.length}`);

  // past denials feed the /denials review page — terminal stage with a full determination record
  const denied = apps.filter((a) => a.stage === "denied");
  check("denied applications seeded with determination records",
    denied.length >= 2 && denied.every((a) => !!a.decisionNote && !!a.decidedBy && !!a.decidedAt),
    `got ${denied.length}`);

  // eligibility document-verification rows, incl. the seeded A-1174 SSN bypass
  const bypass = (await db.select().from(t.applicationDocs)
    .where(and(eq(t.applicationDocs.applicationId, "A-1174"), eq(t.applicationDocs.docKey, "ssn"))))[0];
  check("A-1174 ssn bypass row", bypass?.status === "verified" && !!bypass?.bypassBy && !bypass?.fileName);

  // identity column: insert without id, returning
  const inserted = await db.insert(t.serviceLog).values({
    date: "2026-06-11", clientId: clients[0].id, code: "SDA 1a", programId: "cad-a", staffId: "dr", note: "smoke",
  }).returning({ id: t.serviceLog.id });
  check("identity id assigned on insert", Number.isInteger(inserted[0]?.id) && inserted[0].id > 0, `id ${inserted[0]?.id}`);

  // service-log attachment columns (file_name / file_path)
  const withFile = await db.insert(t.serviceLog).values({
    date: "2026-06-11", clientId: clients[0].id, code: "SRV 4e", programId: "cad-a", staffId: "dr",
    note: "smoke attachment", fileName: "receipt.pdf", filePath: "service-log/C-1/svc-1.pdf",
  }).returning({ id: t.serviceLog.id, fileName: t.serviceLog.fileName });
  check("service_log attachment columns roundtrip", withFile[0]?.fileName === "receipt.pdf");

  // per-program service availability (program_services)
  await db.insert(t.programServices).values([
    { programId: "cad-a", code: "SDA 1a" },
    { programId: "cad-a", code: "SRV 4e" },
  ]);
  const psRows = await db.select().from(t.programServices).where(eq(t.programServices.programId, "cad-a"));
  check("program_services roundtrip", psRows.length === 2, `got ${psRows.length}`);
  await db.delete(t.programServices).where(eq(t.programServices.programId, "cad-a"));

  // transaction commit + rollback semantics (the approve flow uses a transaction)
  await db.transaction(async (tx) => {
    await tx.insert(t.kv).values({ key: "smoke", value: { ok: true } });
  });
  const kvRow = (await db.select().from(t.kv).where(eq(t.kv.key, "smoke")))[0];
  check("transaction committed, jsonb kv roundtrip", (kvRow?.value as { ok?: boolean })?.ok === true);
  let rolledBack = false;
  try {
    await db.transaction(async (tx) => {
      await tx.update(t.kv).set({ value: { ok: false } }).where(eq(t.kv.key, "smoke"));
      throw new Error("force rollback");
    });
  } catch {
    rolledBack = true;
  }
  const after = (await db.select().from(t.kv).where(eq(t.kv.key, "smoke")))[0];
  check("transaction rolled back on error", rolledBack && (after?.value as { ok?: boolean })?.ok === true);

  // update + delete builders
  await db.update(t.applicationDocs).set({ status: "submitted" })
    .where(and(eq(t.applicationDocs.applicationId, "A-1174"), eq(t.applicationDocs.docKey, "ssn")));
  const flipped = (await db.select().from(t.applicationDocs)
    .where(and(eq(t.applicationDocs.applicationId, "A-1174"), eq(t.applicationDocs.docKey, "ssn"))))[0];
  check("update builder works", flipped?.status === "submitted");
  await db.delete(t.kv).where(eq(t.kv.key, "smoke"));
  check("delete builder works", (await db.select().from(t.kv).where(eq(t.kv.key, "smoke"))).length === 0);

  await pglite.close();
  console.log(failures === 0 ? "\nSmoke test passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
