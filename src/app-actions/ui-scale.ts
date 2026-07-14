"use server";
/* Per-user interface scale — set from the user menu, applied as a zoom on the
   app shell by the layout. Big monitors go larger; small screens can go
   smaller to fit more on screen. */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";

const UI_SCALES = [90, 100, 110, 125];

export async function setMyUiScale(scale: number): Promise<void> {
  const user = await requireUser();
  const clean = UI_SCALES.includes(Number(scale)) ? Number(scale) : 100;
  await db.update(t.users).set({ uiScale: clean }).where(eq(t.users.id, user.id));
  revalidatePath("/", "layout");
}
