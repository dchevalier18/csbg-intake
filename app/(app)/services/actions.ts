"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, visibleClient } from "@/lib/access";
import { currentFY, todayIso } from "@/lib/format";

export interface ServiceEntryResult {
  ok: boolean;
  message: string;
}

/** Log a service for a client. Re-validates client visibility + program membership server-side. */
export async function addServiceEntry(input: {
  clientId: string;
  code: string;
  programId: string;
  note: string;
}): Promise<ServiceEntryResult> {
  const user = await requireUser();
  const clientId = String(input.clientId ?? "").trim();
  const code = String(input.code ?? "").trim();
  const programId = String(input.programId ?? "").trim();
  const note = String(input.note ?? "").trim();

  if (!clientId || !code) return { ok: false, message: "Pick a client and a service first." };

  // Client must be visible to this user (program-scoped).
  const client = visibleClient(user, clientId);
  if (!client) return { ok: false, message: "That client isn't visible to your account." };

  // Program must be one the client is enrolled in AND one the user can see.
  if (!programId || !client.programIds.includes(programId)) {
    return { ok: false, message: "That client isn't enrolled in the selected program." };
  }
  if (!userCanSeeProgram(user, programId)) {
    return { ok: false, message: "Your account isn't assigned to that program." };
  }

  // Service code must exist and be active.
  const svc = db.select().from(t.services).where(eq(t.services.code, code)).get();
  if (!svc || svc.active !== 1) {
    return { ok: false, message: "Unknown or inactive service code." };
  }

  const res = db.insert(t.serviceLog).values({
    date: todayIso(),
    clientId,
    code,
    programId,
    staffId: user.id,
    note: note || "—",
  }).run();

  audit(
    user.id,
    "service.log",
    "service_log",
    String(res.lastInsertRowid),
    `${code} · ${client.first} ${client.last} (${clientId}) · ${programId}`,
  );

  revalidatePath("/services");
  revalidatePath(`/clients/${clientId}`);

  return { ok: true, message: `Service logged — mapped to ${code} for the ${currentFY().short} rollup.` };
}
