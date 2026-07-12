"use server";
/* Per-user UI language preference — set from the user menu, read by
   LangProvider in the app layout. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";

export async function setMyLocale(locale: string): Promise<void> {
  const user = await requireUser();
  const clean = locale === "es" ? "es" : "en";
  await db.update(t.users).set({ locale: clean }).where(eq(t.users.id, user.id));
  revalidatePath("/", "layout");
}
