/* Serves a service-log attachment from data/uploads/ — access is re-checked
   against the entry's program (same scoping as the service log itself). */
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { userCanSeeProgram } from "@/lib/access";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to view attachments.", { status: 401 });

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return new Response("Not found.", { status: 404 });

  const entry = (await db.select().from(t.serviceLog).where(eq(t.serviceLog.id, entryId)))[0];
  // out-of-scope callers get the same 404 as a missing entry — don't leak existence
  if (!entry?.filePath || !await userCanSeeProgram(user, entry.programId)) {
    return new Response("Not found.", { status: 404 });
  }

  const resolved = path.resolve(UPLOADS_DIR, entry.filePath);
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR) + path.sep) || !fs.existsSync(resolved)) {
    return new Response("File is no longer on disk.", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const body = new Uint8Array(fs.readFileSync(resolved));
  return new Response(body, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      // inline so PDFs/images open in the browser tab; the original name survives a save
      "Content-Disposition": `inline; filename="${(entry.fileName ?? `attachment${ext}`).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
