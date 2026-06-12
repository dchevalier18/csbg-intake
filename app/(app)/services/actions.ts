"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, visibleClient } from "@/lib/access";
import { serviceAllowedForProgram } from "@/lib/data/core";
import { currentFY, todayIso } from "@/lib/format";

export interface ServiceEntryResult {
  ok: boolean;
  message: string;
}

const UPLOAD_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff"];
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const safeSegment = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/** Log a service for a client. Re-validates client visibility + program membership server-side.
    An optional attachment (receipt, award letter, signed form …) arrives base64-encoded;
    the stored copy lives under data/uploads/service-log/. */
export async function addServiceEntry(input: {
  clientId: string;
  code: string;
  programId: string;
  note: string;
  attachment?: { name: string; base64: string } | null;
}): Promise<ServiceEntryResult> {
  const user = await requireUser();
  const clientId = String(input.clientId ?? "").trim();
  const code = String(input.code ?? "").trim();
  const programId = String(input.programId ?? "").trim();
  const note = String(input.note ?? "").trim();

  if (!clientId || !code) return { ok: false, message: "Pick a client and a service first." };

  // Client must be visible to this user (program-scoped).
  const client = await visibleClient(user, clientId);
  if (!client) return { ok: false, message: "That client isn't visible to your account." };

  // Program must be one the client is enrolled in AND one the user can see.
  if (!programId || !client.programIds.includes(programId)) {
    return { ok: false, message: "That client isn't enrolled in the selected program." };
  }
  if (!await userCanSeeProgram(user, programId)) {
    return { ok: false, message: "Your account isn't assigned to that program." };
  }

  // Service code must exist, be active, and be offered by the program.
  const svc = (await db.select().from(t.services).where(eq(t.services.code, code)))[0];
  if (!svc || svc.active !== 1) {
    return { ok: false, message: "Unknown or inactive service code." };
  }
  if (!await serviceAllowedForProgram(code, programId)) {
    return { ok: false, message: "That service isn't offered by the selected program — an administrator manages the list in Settings → Services." };
  }

  // Validate + store the attachment BEFORE inserting, so a rejected file never
  // leaves a half-written entry.
  let fileName: string | null = null;
  let filePath: string | null = null;
  if (input.attachment) {
    const ext = path.extname(input.attachment.name ?? "").toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(ext)) {
      return { ok: false, message: "That file type isn't supported — attach a PDF or a scanned image (JPG, PNG, HEIC, TIFF)." };
    }
    const buf = Buffer.from(String(input.attachment.base64 ?? ""), "base64");
    if (buf.length === 0) return { ok: false, message: "That file looks empty — rescan the document and try again." };
    if (buf.length > MAX_UPLOAD_BYTES) {
      return { ok: false, message: "Files up to 4 MB are supported — scan at a lower resolution or split the document." };
    }
    const dir = path.join(UPLOADS_DIR, "service-log", safeSegment(clientId));
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `svc-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(dir, storedName), buf);
    fileName = input.attachment.name;
    filePath = `service-log/${safeSegment(clientId)}/${storedName}`;
  }

  const inserted = await db.insert(t.serviceLog).values({
    date: todayIso(),
    clientId,
    code,
    programId,
    staffId: user.id,
    note: note || "—",
    fileName,
    filePath,
  }).returning({ id: t.serviceLog.id });

  await audit(
    user.id,
    "service.log",
    "service_log",
    String(inserted[0].id),
    `${code} · ${client.first} ${client.last} (${clientId}) · ${programId}${fileName ? ` · "${fileName}" attached` : ""}`,
  );

  revalidatePath("/services");
  revalidatePath(`/clients/${clientId}`);

  return { ok: true, message: `Service logged — mapped to ${code} for the ${currentFY().short} rollup.` };
}
