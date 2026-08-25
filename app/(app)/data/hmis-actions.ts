"use server";
/* PA HMIS sync actions — admin-only. Per the CACLV ↔ PA HMIS operating
   understanding, synced records feed internal tracking & reporting:
   dedup-linked, blank-filled, and imported into the client directory. */
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { kvGet, kvSet, nextClientId } from "@/lib/data/core";
import { fmt, shortDate, todayIso } from "@/lib/format";
import {
  assessCoverage, createClientFromHmis, describeWindow, describeWindows, fetchHmisClients,
  getHmisConfig, hmisConnectionTest, runHmisMatching, validateWindow,
} from "@/lib/hmis";

export interface HmisActionResult { ok: boolean; message: string }

/** Test connection reports its two steps separately — credentials and stored
    procedure fail for unrelated reasons, and collapsing them sends people to
    regenerate keys that were never the problem. */
export interface HmisTestResult extends HmisActionResult { lines: string[] }

const NOT_CONFIGURED =
  "HMIS isn't configured — set the connection in Settings → Integrations (or via HMIS_* environment variables).";

/** GET /auth/test, then the configured stored procedure (if any). No client
    data is stored either way. */
export async function testHmisConnection(): Promise<HmisTestResult> {
  const user = await requireAdmin();
  const { cfg } = await getHmisConfig();
  if (!cfg) return { ok: false, message: NOT_CONFIGURED, lines: [NOT_CONFIGURED] };
  const { auth, procedure } = await hmisConnectionTest(cfg);
  const lines = [
    `Credentials: ${auth.ok ? "accepted" : "rejected"} — ${auth.message}`,
    `Stored procedure: ${procedure.configured ? (procedure.ok ? "ran" : "failed") : "not set"} — ${procedure.message}`,
  ];
  await audit(user.id, "hmis.test", "integration", "hmis",
    `Credentials ${auth.ok ? "accepted" : "rejected"}`
    + `${auth.environment ? ` (${auth.environment} ClientTrack environment)` : ""}`
    + `; stored procedure ${procedure.configured ? `${procedure.procedure} ${procedure.ok ? "ran" : "failed"}` : "not configured"}`
    + `${procedure.columns.length ? ` — columns: ${procedure.columns.join(", ")}` : ""}`);
  return {
    ok: auth.ok && procedure.ok,
    message: auth.ok && procedure.ok
      ? (procedure.configured ? "Connected — credentials accepted and the stored procedure ran." : auth.message)
      : (auth.ok ? procedure.message : auth.message),
    lines,
  };
}

/** Set the program HMIS-imported clients enroll into. */
export async function setHmisProgram(programId: string): Promise<HmisActionResult> {
  const user = await requireAdmin();
  const program = (await db.select().from(t.programs).where(eq(t.programs.id, programId)))[0];
  if (!program || program.active !== 1) return { ok: false, message: "Pick an active program." };
  await kvSet("hmisProgramId", programId);
  await audit(user.id, "hmis.program.set", "integration", "hmis", `HMIS imports enroll into ${program.name}`);
  revalidatePath("/data");
  return { ok: true, message: `HMIS imports will enroll into ${program.name}.` };
}

/** Periods already pulled, newest first. The import-job rows ARE the coverage
    record, so undoing a sync frees its period in the same stroke. */
export async function getHmisCoverage(): Promise<HmisSyncPeriod[]> {
  await requireAdmin();
  const rows = await db.select({
    jobId: t.importJobs.id,
    at: t.importJobs.at,
    start: t.importJobs.hmisStart,
    end: t.importJobs.hmisEnd,
    pulled: t.importJobs.imported,
    updated: t.importJobs.updated,
  }).from(t.importJobs).where(eq(t.importJobs.template, "hmis"));
  return rows
    .filter((r): r is typeof r & { start: string; end: string } => Boolean(r.start && r.end))
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((r) => ({
      jobId: r.jobId, at: r.at, start: r.start, end: r.end,
      created: r.pulled, enriched: r.updated,
    }));
}

export interface HmisSyncPeriod {
  jobId: number;
  at: string;
  start: string;
  end: string;
  created: number;
  enriched: number;
}

/** Pull one reporting period, merge it into the hmis_clients snapshot, and run
    the integration pass: link, fill blanks, queue near matches, and import
    unmatched people as client records (internal tracking & reporting).

    The period is explicit rather than configured, and every completed sync
    records the window it covered — so asking for days already pulled is caught
    here instead of quietly re-importing them. `force` overrides that for a
    deliberate re-pull (data corrected on the HMIS side, say). */
export async function runHmisSync(
  requested: { start: string; end: string },
  opts: { force?: boolean } = {},
): Promise<HmisActionResult> {
  const user = await requireAdmin();
  const { cfg } = await getHmisConfig();
  if (!cfg) return { ok: false, message: NOT_CONFIGURED };

  const valid = validateWindow(requested);
  if (!valid.ok) return { ok: false, message: valid.message };
  let window = valid.value;

  // Coverage is only meaningful for the procedure path — the CRQL query has no
  // WHERE clause, so it always returns everything regardless of the dates.
  const rangeApplies = Boolean(cfg.storedProcedure && cfg.dateParams.startKey && cfg.dateParams.endKey);
  let narrowed: string | null = null;
  if (rangeApplies && !opts.force) {
    const covered = (await getHmisCoverage()).map((p) => ({ start: p.start, end: p.end }));
    const verdict = assessCoverage(window, covered);
    if (verdict.fullyCovered) {
      return {
        ok: false,
        message: `${describeWindow(window)} has already been synced`
          + ` (covered by ${describeWindows(verdict.overlapping)}).`
          + " Pick a different period, or re-sync it deliberately to pull corrected HMIS data.",
      };
    }
    if (!verdict.untouched) {
      // One contiguous gap can simply be pulled. Several means the request
      // straddles covered islands, and silently issuing one POST per gap would
      // make a single click fan out into several production calls.
      if (verdict.gaps.length === 1) {
        narrowed = `narrowed to ${describeWindow(verdict.gaps[0])} — the rest was already synced`
          + ` (${describeWindows(verdict.overlapping)})`;
        window = verdict.gaps[0];
      } else {
        return {
          ok: false,
          message: `Part of ${describeWindow(window)} was already synced`
            + ` (${describeWindows(verdict.overlapping)}), leaving more than one gap:`
            + ` ${describeWindows(verdict.gaps)}. Sync those one at a time.`,
        };
      }
    }
  }

  let pull;
  try {
    pull = await fetchHmisClients(cfg, { window });
  } catch (e) {
    return { ok: false, message: `Sync failed while pulling from PA HMIS: ${e instanceof Error ? e.message : String(e)}` };
  }
  const rows = pull.rows;
  if (rows.length === 0) {
    // say which source came back empty, and what it did return — with an
    // unverified procedure output, "no records" is usually a mapping problem
    const where = pull.source === "procedure"
      ? `the stored procedure ${pull.procedure}`
      : "the CRQL query";
    return {
      ok: false,
      message: `PA HMIS answered but ${where} produced no client records`
        + `${pull.dateWindow ? ` for ${describeWindow(pull.dateWindow)}` : ""}`
        + `${pull.rawRowCount > 0 ? ` from ${fmt(pull.rawRowCount)} returned row(s)` : ""}.`
        + `${pull.note ? ` ${pull.note}.` : pull.source === "crql"
          ? " Verify the CRQL column names in CRQL_CLIENT_FIELDS against the API docs."
          : ""}`,
    };
  }

  // Merge, don't replace. This used to delete the table first, which was right
  // while every sync pulled everything — but a sync now covers one period, and
  // wiping the table would drop every earlier period's rows, leaving the
  // organization-wide unduplicated count on /reports reflecting only the most
  // recent window. Upsert on hmis_id (the PK, and the durable HMIS link key)
  // keeps prior periods and refreshes anyone this pull saw again.
  const now = new Date().toISOString();
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(t.hmisClients)
      .values(rows.slice(i, i + CHUNK).map((r) => ({ ...r, fetchedAt: now })))
      .onConflictDoUpdate({
        target: t.hmisClients.hmisId,
        set: {
          first: sql`excluded.first`, last: sql`excluded.last`, dob: sql`excluded.dob`,
          email: sql`excluded.email`, phone: sql`excluded.phone`, sex: sql`excluded.sex`,
          race: sql`excluded.race`, veteran: sql`excluded.veteran`,
          insurance: sql`excluded.insurance`, incomeSrc: sql`excluded.income_src`,
          nonCash: sql`excluded.non_cash`, services: sql`excluded.services`,
          household: sql`excluded.household`, fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }

  // Logged as an import job before the pass runs, so created clients can carry
  // its id — the same mechanism spreadsheet imports use, which is what puts this
  // sync in Recent imports with an Undo button.
  const source = pull.source === "procedure" ? `${pull.procedure}` : "CRQL query on cmClient";
  const [job] = await db.insert(t.importJobs).values({
    at: now,
    template: "hmis",
    filename: source,
    imported: 0,
    updated: 0,
    skipped: 0,
    staffId: user.id,
    detail: "",
    // the coverage record — read back by getHmisCoverage on the next sync
    hmisStart: pull.dateWindow?.start ?? null,
    hmisEnd: pull.dateWindow?.end ?? null,
  }).returning({ id: t.importJobs.id });

  const programId = await kvGet<string | null>("hmisProgramId", null);
  const { stats, undo } = await runHmisMatching(rows, user.id, programId, nextClientId, job.id);
  await db.update(t.importJobs).set({
    imported: stats.created,
    updated: stats.enriched,
    skipped: stats.noDob + stats.noProgram,
    detail: `${pull.dateWindow ? `${describeWindow(pull.dateWindow)} · ` : ""}`
      + `${fmt(rows.length)} pulled — ${stats.autoLinked} auto-linked, ${stats.queued} queued for review`,
    hmisUndo: undo,
  }).where(eq(t.importJobs.id, job.id));
  await kvSet("hmisSync", { at: now, pulled: rows.length, ...stats });
  await db.update(t.integrations)
    .set({ status: "connected", lastSync: shortDate(todayIso()), records: `${fmt(rows.length)} HMIS records` })
    .where(eq(t.integrations.id, "hmis"));
  await audit(user.id, "hmis.sync", "integration", "hmis",
    `${fmt(rows.length)} pulled from ${pull.source === "procedure" ? pull.procedure : "CRQL cmClient"}`
    + `${pull.dateWindow ? ` for ${describeWindow(pull.dateWindow)}` : ""}`
    + `${pull.note ? ` [${pull.note}]` : ""} — ${stats.alreadyLinked} already linked, ${stats.autoLinked} auto-linked, ${stats.enriched} blank-filled, ${stats.created} imported as clients, ${stats.queued} queued for review${stats.noDob ? `, ${stats.noDob} without DOB` : ""}${stats.noProgram ? `, ${stats.noProgram} skipped (no enrollment program set)` : ""}`);
  revalidatePath("/data");
  revalidatePath("/reports");
  revalidatePath("/clients");
  const parts = [
    `${fmt(stats.created)} imported as new clients`,
    `${fmt(stats.autoLinked)} auto-linked`,
    `${fmt(stats.enriched)} records blank-filled`,
    `${fmt(stats.queued)} need review`,
  ];
  if (stats.noProgram > 0) parts.push(`${fmt(stats.noProgram)} skipped — set the enrollment program`);
  if (stats.noDob > 0) parts.push(`${fmt(stats.noDob)} kept snapshot-only (no DOB)`);
  // A pull that stopped after exactly one full page can't be told apart from a
  // result set that CRQL's mandatory TOP bounded before paging applied, so say
  // so rather than presenting it as a complete snapshot.
  const caveat = pull.singlePageCapped
    ? ` This pull filled exactly one page (${fmt(rows.length)} records) and the next page was empty — confirm with PA HMIS that paging works inside SELECT TOP before treating it as the full statewide snapshot.`
    : "";
  // the procedure's output shape is unverified, so anything the mapping didn't
  // understand is reported here rather than left in a server log
  const sourceLabel = pull.source === "procedure" ? `${pull.procedure}` : "the CRQL query";
  const mapping = pull.note ? ` Note: ${pull.note}.` : "";
  const period = pull.dateWindow ? ` for ${describeWindow(pull.dateWindow)}` : "";
  // said plainly: the operator asked for one period and got another, and the
  // coverage record will show the narrowed one, not what they typed
  const narrowNote = narrowed ? ` This run was ${narrowed}.` : "";
  return {
    ok: true,
    message: `Synced ${fmt(rows.length)} HMIS records${period} from ${sourceLabel}`
      + ` — ${parts.join(", ")}.${narrowNote}${caveat}${mapping}`,
  };
}

/** Resolve a held HMIS near-match: link to a candidate, import as a new
    client record, or dismiss (not the same person, keep snapshot-only). */
export async function resolveHmisReview(
  reviewId: number,
  action: { type: "link"; clientId: string } | { type: "create" } | { type: "dismiss" },
): Promise<HmisActionResult> {
  const user = await requireAdmin();
  const review = (await db.select().from(t.hmisReviews).where(eq(t.hmisReviews.id, reviewId)))[0];
  if (!review) return { ok: false, message: "Review not found." };
  if (review.status !== "pending") return { ok: false, message: "This match was already resolved." };

  const now = new Date().toISOString();
  if (action.type === "link") {
    if (!review.candidateIds.includes(action.clientId)) {
      return { ok: false, message: "Pick one of the candidate records." };
    }
    await db.insert(t.clientExternalIds)
      .values({ system: "hmis", externalId: review.hmisId, clientId: action.clientId, linkedAt: now, linkedBy: user.id })
      .onConflictDoNothing();
    await db.update(t.hmisReviews)
      .set({ status: "resolved", resolution: "linked", resolvedClientId: action.clientId, resolvedBy: user.id, resolvedAt: now })
      .where(eq(t.hmisReviews.id, reviewId));
    await audit(user.id, "hmis.link", "client", action.clientId, `Linked to HMIS record on review (queue #${reviewId})`);
    revalidatePath("/data");
    revalidatePath("/reports");
    return { ok: true, message: `Linked — this HMIS record now counts as the same person as ${action.clientId}.` };
  }

  if (action.type === "create") {
    const row = (await db.select().from(t.hmisClients).where(eq(t.hmisClients.hmisId, review.hmisId)))[0];
    if (!row) return { ok: false, message: "This HMIS record is no longer in the snapshot — run a sync first." };
    if (!row.dob) return { ok: false, message: "This HMIS record has no date of birth — it can't become a client record yet." };
    const programId = await kvGet<string | null>("hmisProgramId", null);
    if (!programId) return { ok: false, message: "Set the HMIS enrollment program first (above)." };
    const clientId = await createClientFromHmis({ ...row, services: row.services, household: row.household }, programId, user.id, nextClientId);
    if (!clientId) return { ok: false, message: "Could not create the record." };
    await db.update(t.hmisReviews)
      .set({ status: "resolved", resolution: "created", resolvedClientId: clientId, resolvedBy: user.id, resolvedAt: now })
      .where(eq(t.hmisReviews.id, reviewId));
    await audit(user.id, "hmis.create", "client", clientId, `Imported from HMIS on review (queue #${reviewId})`);
    revalidatePath("/data");
    revalidatePath("/reports");
    revalidatePath("/clients");
    return { ok: true, message: `Imported as new client record ${clientId}.` };
  }

  await db.update(t.hmisReviews)
    .set({ status: "resolved", resolution: "dismissed", resolvedBy: user.id, resolvedAt: now })
    .where(eq(t.hmisReviews.id, reviewId));
  await audit(user.id, "hmis.dismiss", "hmis_review", String(reviewId), "Marked as not the same person");
  revalidatePath("/data");
  revalidatePath("/reports");
  return { ok: true, message: "Dismissed — kept snapshot-only; these count as two different people." };
}
