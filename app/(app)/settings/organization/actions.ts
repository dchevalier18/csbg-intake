"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/access";
import { ACCENTS } from "@/lib/program-types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const FY_STARTS = ["October", "July", "January", "April"];
const CEILINGS = [100, 125, 150, 175, 200];
const LOGO_MODES = ["calv", "wordmark", "upload"];
// ≈ 500 KB image encoded as a base64 data URL
const MAX_LOGO_CHARS = 800_000;

export interface OrgProfileInput {
  name: string;
  short: string;
  tagline: string;
  region: string;
  fyStart: string;
  csbgCeiling: number;
}

export async function updateOrgProfile(input: OrgProfileInput): Promise<ActionResult> {
  const user = await requireAdmin();
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, message: "Organization name is required." };
  const fyStart = FY_STARTS.includes(input.fyStart) ? input.fyStart : "October";
  const csbgCeiling = CEILINGS.includes(Number(input.csbgCeiling)) ? Number(input.csbgCeiling) : 125;
  db.update(t.organization)
    .set({
      name,
      short: (input.short ?? "").trim(),
      tagline: (input.tagline ?? "").trim(),
      region: (input.region ?? "").trim(),
      fyStart,
      csbgCeiling,
    })
    .where(eq(t.organization.id, 1))
    .run();
  audit(user.id, "org.update", "organization", "1", `Agency profile saved (${name}, FY starts ${fyStart}, ceiling ${csbgCeiling}% FPL)`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Agency profile saved." };
}

export async function updateOrgAccent(hex: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const accent = ACCENTS.find((a) => a.hex === hex);
  if (!accent) return { ok: false, message: "Pick one of the offered brand colors." };
  db.update(t.organization).set({ accent: accent.hex }).where(eq(t.organization.id, 1)).run();
  audit(user.id, "org.update", "organization", "1", `Brand color → ${accent.name} (${accent.hex})`);
  revalidatePath("/", "layout");
  return { ok: true, message: `Brand color set to ${accent.name} — the whole workspace re-skinned.` };
}

export async function updateOrgLogo(input: { mode: string; data?: string | null }): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!LOGO_MODES.includes(input.mode)) return { ok: false, message: "Unknown logo option." };

  if (input.mode === "upload") {
    const data = input.data ?? "";
    if (!data.startsWith("data:image/")) return { ok: false, message: "That file doesn't look like an image." };
    if (data.length > MAX_LOGO_CHARS) return { ok: false, message: "That image is too large — keep it under 500 KB." };
    db.update(t.organization).set({ logoMode: "upload", logoData: data }).where(eq(t.organization.id, 1)).run();
    audit(user.id, "org.update", "organization", "1", "Logo uploaded (custom image)");
    revalidatePath("/", "layout");
    return { ok: true, message: "Logo uploaded — your sidebar updated." };
  }

  db.update(t.organization).set({ logoMode: input.mode }).where(eq(t.organization.id, 1)).run();
  audit(user.id, "org.update", "organization", "1", `Logo mode → ${input.mode}`);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: input.mode === "wordmark" ? "Logo set to the text wordmark." : "Logo set to the CALV brand mark.",
  };
}
