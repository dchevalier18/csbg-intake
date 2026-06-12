"use server";
/* Settings → Services — catalog editor (add / edit / retire) and per-program
   service availability. Service rows are never deleted: history in service_log
   references codes, and the Annual Report rollup needs their labels. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { DOMAINS } from "@/lib/csbg-catalog";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const domainName = (id: string) => DOMAINS.find((d) => d.id === id)?.name ?? id;

function cleanService(input: { domain: string; label: string }): { ok: true; domain: string; label: string } | { ok: false; message: string } {
  const label = (input.label ?? "").trim();
  if (!label) return { ok: false, message: "A service label is required." };
  if (!DOMAINS.some((d) => d.id === input.domain)) return { ok: false, message: "Pick a reporting domain." };
  return { ok: true, domain: input.domain, label };
}

/** Add a service to the catalog. Codes are free-form (CSBG "SRV 4i" or an
    agency-local code) but must be unique — they key the rollup. */
export async function createService(input: { code: string; domain: string; label: string }): Promise<ActionResult> {
  const user = await requireAdmin();
  const code = (input.code ?? "").trim();
  if (!code) return { ok: false, message: "A service code is required — e.g. “SRV 4i”, or an agency code like “CALV 1”." };
  if (code.length > 24) return { ok: false, message: "Keep the service code under 24 characters." };
  const v = cleanService(input);
  if (!v.ok) return { ok: false, message: v.message };

  const existing = await db.select({ code: t.services.code, sort: t.services.sort }).from(t.services);
  if (existing.some((s) => s.code.toLowerCase() === code.toLowerCase())) {
    return { ok: false, message: `Code “${code}” is already in the catalog.` };
  }
  const sort = existing.reduce((m, s) => Math.max(m, s.sort), 0) + 1;

  await db.insert(t.services).values({ code, domain: v.domain, label: v.label, active: 1, sort });
  await audit(user.id, "service.create", "service", code, `${v.label} · ${domainName(v.domain)}`);
  revalidatePath("/", "layout");
  return { ok: true, message: `“${v.label}” added to the catalog under ${domainName(v.domain)}.` };
}

/** Edit a service's label / domain, or retire / reactivate it. Retiring removes
    it from every picker; logged history keeps reporting under its label. */
export async function updateService(code: string, input: { domain: string; label: string; active: boolean }): Promise<ActionResult> {
  const user = await requireAdmin();
  const existing = (await db.select().from(t.services).where(eq(t.services.code, code)))[0];
  if (!existing) return { ok: false, message: "That service is no longer in the catalog." };
  const v = cleanService(input);
  if (!v.ok) return { ok: false, message: v.message };

  const active = input.active ? 1 : 0;
  await db.update(t.services).set({ domain: v.domain, label: v.label, active }).where(eq(t.services.code, code));

  const changes = [
    existing.label !== v.label ? `label “${existing.label}” → “${v.label}”` : "",
    existing.domain !== v.domain ? `domain ${domainName(existing.domain)} → ${domainName(v.domain)}` : "",
    existing.active !== active ? (active ? "reactivated" : "retired") : "",
  ].filter(Boolean).join(" · ");
  if (!changes) return { ok: true, message: "No changes to save." };

  await audit(user.id, "service.update", "service", code, changes);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: existing.active === 1 && active === 0
      ? `“${v.label}” retired — it left every picker; logged entries keep reporting under it.`
      : "Service updated.",
  };
}

/** Set which services a program offers. `null` restores the full catalog;
    a list restricts the program's pickers to those codes. */
export async function setProgramServices(programId: string, codes: string[] | null): Promise<ActionResult> {
  const user = await requireAdmin();
  const program = (await db.select().from(t.programs).where(eq(t.programs.id, programId)))[0];
  if (!program || program.active !== 1) return { ok: false, message: "That program no longer exists." };

  let clean: string[] | null = null;
  if (codes !== null) {
    const catalog = new Set((await db.select({ code: t.services.code }).from(t.services)).map((r) => r.code));
    clean = [...new Set((codes ?? []).filter((c) => catalog.has(c)))];
    if (clean.length === 0) {
      return { ok: false, message: "Pick at least one service, or switch the program back to the full catalog." };
    }
  }

  await db.delete(t.programServices).where(eq(t.programServices.programId, programId));
  if (clean) {
    await db.insert(t.programServices).values(clean.map((code) => ({ programId, code })));
  }
  await audit(user.id, "program.services", "program", programId,
    clean ? `Service list limited to ${clean.length} service${clean.length === 1 ? "" : "s"}` : "Full service catalog restored");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: clean
      ? `${program.short} now offers ${clean.length} service${clean.length === 1 ? "" : "s"} — its pickers update everywhere.`
      : `${program.short} now offers the full service catalog.`,
  };
}
