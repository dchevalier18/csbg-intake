"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { getActiveFpl } from "@/lib/fpl";
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
  await db.update(t.fplSchedules).set({ status: "archived" });
  await db.insert(t.fplSchedules).values({ year: y, base: b, perAdditional: p, effective: todayIso(), status: "active" });
  const clientCount = (await db.select({ id: t.clients.id }).from(t.clients)).length;
  const openApps = (await db.select({ stage: t.applications.stage }).from(t.applications))
    .filter((a) => (OPEN_STAGES as readonly string[]).includes(a.stage)).length;
  const n = clientCount + openApps;
  await audit(admin.id, "fpl.publish", "fpl", String(y), `Published FPL ${y} — household of 1 $${b}, each additional $${p}; ${n} cases stay pinned`);
  revalidatePath("/", "layout");
  return { ok: true, message: `FPL ${y} is now active. ${n} existing cases remain pinned to the schedule they were assessed under.` };
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
