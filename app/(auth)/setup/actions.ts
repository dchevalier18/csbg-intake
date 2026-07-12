"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { hashPassword, createSession } from "@/lib/auth";
import { audit } from "@/lib/access";
import { JURISDICTIONS } from "@/lib/fpl-data";
import { initialsOf } from "@/lib/format";

export interface SetupState {
  error?: string;
}

const CEILINGS = [100, 125, 150, 175, 200];
const LOOKBACKS = [30, 60, 90, 365];

/** Complete first-run setup: finish the organization profile and create the
    first administrator. Refuses to run once ANY user exists — this is the
    only unauthenticated write path in the app, and it self-destructs. */
export async function completeSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const existing = await db.select({ id: t.users.id }).from(t.users);
  if (existing.length > 0) return { error: "This install is already set up. Sign in instead." };

  const orgName = String(formData.get("orgName") ?? "").trim();
  const short = String(formData.get("short") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const jurisdiction = String(formData.get("jurisdiction") ?? "contiguous48");
  const csbgCeiling = Number(formData.get("csbgCeiling") ?? 125);
  const incomeLookbackDays = Number(formData.get("incomeLookbackDays") ?? 90);
  const adminName = String(formData.get("adminName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!orgName) return { error: "Enter your agency's name." };
  if (!adminName) return { error: "Enter the administrator's name." };
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: "Usernames are 3-32 characters: lowercase letters, numbers, dots, dashes." };
  }
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  if (password !== confirm) return { error: "The passwords don't match." };
  if (!JURISDICTIONS.some((j) => j.id === jurisdiction)) return { error: "Pick a valid guideline table." };
  if (!CEILINGS.includes(csbgCeiling)) return { error: "Pick a valid income ceiling." };
  if (!LOOKBACKS.includes(incomeLookbackDays)) return { error: "Pick a valid income lookback." };

  const userId = "admin";
  try {
    await db.update(t.organization).set({
      name: orgName,
      short: short || initialsOf(orgName),
      region,
      jurisdiction,
      csbgCeiling,
      incomeLookbackDays,
      logoMode: "wordmark",
    }).where(eq(t.organization.id, 1));

    await db.insert(t.users).values({
      id: userId,
      name: adminName,
      username,
      passwordHash: hashPassword(password),
      role: "Data Admin",
      access: "all",
      initials: initialsOf(adminName),
      active: 1,
    });

    await audit(userId, "setup.complete", "organization", "1",
      `First-run setup — ${orgName} (${jurisdiction}, ${csbgCeiling}% ceiling, ${incomeLookbackDays}-day lookback); administrator ${username} created`);
    await createSession(userId);
  } catch (err) {
    // Setup must never fail silently — surface the failure in the form.
    console.error("[setup] first-run setup failed:", err);
    return { error: "Setup couldn't be completed — the server reported an error. Details were written to data/server.log; fix the cause and submit again." };
  }
  redirect("/settings/programs");
}
