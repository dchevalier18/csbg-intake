"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { getActiveFpl } from "@/lib/fpl";
import { officialFpl, JURISDICTIONS, jurisdictionLabel, type Jurisdiction } from "@/lib/fpl-data";
import { OPEN_STAGES } from "@/lib/data/core";
import { todayIso } from "@/lib/format";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Patch the ACTIVE schedule in place — allowed ONLY while no case is pinned to it.
    Pinning is by year, so an in-place edit would silently re-derive every
    determination already assessed under this year. Once cases are pinned,
    corrections must go through "Publish new year" instead. */
export async function patchActiveFpl(base: number, perAdditional: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const b = Math.round(Number(base));
  const p = Math.round(Number(perAdditional));
  if (!Number.isFinite(b) || !Number.isFinite(p) || b <= 0 || p <= 0) {
    return { ok: false, message: "Enter valid guideline amounts." };
  }
  const active = await getActiveFpl();
  const pinnedCount = await casesPinnedTo(active.year);
  if (pinnedCount > 0) {
    return {
      ok: false,
      message: `${pinnedCount} case${pinnedCount === 1 ? " is" : "s are"} already assessed under FPL ${active.year} — editing it in place would rewrite their determinations. Publish a corrected guideline year instead.`,
    };
  }
  await db.update(t.fplSchedules).set({ base: b, perAdditional: p }).where(eq(t.fplSchedules.year, active.year));
  await audit(admin.id, "fpl.update", "fpl", String(active.year), `FPL ${active.year}: household of 1 $${b}, each additional $${p}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cases pinned to a guideline year: enrolled clients + OPEN applications.
    (Approved applications are excluded — they live on as the created client.) */
async function casesPinnedTo(year: number): Promise<number> {
  const clients = (await db.select({ fplYear: t.clients.fplYear }).from(t.clients))
    .filter((c) => c.fplYear === year).length;
  const openApps = (await db.select({ fplYear: t.applications.fplYear, stage: t.applications.stage })
    .from(t.applications))
    .filter((a) => a.fplYear === year && (OPEN_STAGES as readonly string[]).includes(a.stage)).length;
  return clients + openApps;
}

export async function setCsbgCeiling(ceiling: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const c = Number(ceiling);
  if (![100, 125, 150, 175, 200].includes(c)) return { ok: false, message: "Pick a valid ceiling." };
  await db.update(t.organization).set({ csbgCeiling: c }).where(eq(t.organization.id, 1));
  await audit(admin.id, "org.ceiling", "organization", "1", `CSBG income ceiling → ${c}% FPL`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function publishFpl(year: number, base: number, perAdditional: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const y = Math.round(Number(year));
  const b = Math.round(Number(base));
  const p = Math.round(Number(perAdditional));
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return { ok: false, message: "Enter a valid guideline year." };
  if (!Number.isFinite(b) || !Number.isFinite(p) || b <= 0 || p <= 0) {
    return { ok: false, message: "Enter valid guideline amounts." };
  }
  const existing = (await db.select().from(t.fplSchedules).where(eq(t.fplSchedules.year, y)))[0];
  if (existing) return { ok: false, message: `FPL ${y} already exists in the guideline history.` };
  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0];
  const jurisdiction = org?.jurisdiction ?? "contiguous48";
  // warn-don't-block: agencies may publish state-specific figures on purpose
  const official = officialFpl(y, jurisdiction as Jurisdiction);
  const matchesOfficial = official && official.base === b && official.perAdditional === p;
  await db.update(t.fplSchedules).set({ status: "archived" });
  await db.insert(t.fplSchedules).values({
    year: y, base: b, perAdditional: p,
    effective: official?.effective ?? todayIso(),
    status: "active",
    jurisdiction,
  });
  const clientCount = (await db.select({ id: t.clients.id }).from(t.clients)).length;
  const openApps = (await db.select({ stage: t.applications.stage }).from(t.applications))
    .filter((a) => (OPEN_STAGES as readonly string[]).includes(a.stage)).length;
  const n = clientCount + openApps;
  await audit(admin.id, "fpl.publish", "fpl", String(y),
    `Published FPL ${y} (${jurisdictionLabel(jurisdiction)}) — household of 1 $${b}, each additional $${p}; ${n} cases stay pinned`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `FPL ${y} is now active. ${n} existing cases remain pinned to the schedule they were assessed under.` +
      (official && !matchesOfficial
        ? ` Note: the published HHS ${y} table for ${jurisdictionLabel(jurisdiction)} is $${official.base} + $${official.perAdditional} — double-check the figures if that wasn't intentional.`
        : ""),
  };
}

/** Official HHS figures for a year under the agency's jurisdiction — used by the
    Settings UI to prefill "Publish new year". */
export async function officialFplFor(year: number): Promise<{ base: number; perAdditional: number; effective: string; jurisdiction: string; label: string } | null> {
  await requireAdmin();
  const org = (await db.select().from(t.organization).where(eq(t.organization.id, 1)))[0];
  const jurisdiction = (org?.jurisdiction ?? "contiguous48") as Jurisdiction;
  const o = officialFpl(Math.round(Number(year)), jurisdiction);
  return o ? { ...o, jurisdiction, label: jurisdictionLabel(jurisdiction) } : null;
}

/** Agency jurisdiction (which HHS table applies) — affects FUTURE publishes only;
    published schedules keep their stored dollars. */
export async function setJurisdiction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!JURISDICTIONS.some((j) => j.id === id)) return { ok: false, message: "Pick a valid jurisdiction." };
  await db.update(t.organization).set({ jurisdiction: id }).where(eq(t.organization.id, 1));
  await audit(admin.id, "org.jurisdiction", "organization", "1", `FPL jurisdiction → ${jurisdictionLabel(id)}`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Guideline table set to ${jurisdictionLabel(id)}. Published years keep their stored dollars.` };
}

export async function makeFplActive(year: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const y = Math.round(Number(year));
  const target = (await db.select().from(t.fplSchedules).where(eq(t.fplSchedules.year, y)))[0];
  if (!target) return { ok: false, message: "That guideline year doesn't exist." };
  await db.update(t.fplSchedules).set({ status: "archived" });
  await db.update(t.fplSchedules).set({ status: "active" }).where(eq(t.fplSchedules.year, y));
  await audit(admin.id, "fpl.activate", "fpl", String(y), `FPL ${y} re-activated for new assessments`);
  revalidatePath("/", "layout");
  return { ok: true, message: `FPL ${y} set as the active schedule for new assessments. Pinned cases are unaffected.` };
}
