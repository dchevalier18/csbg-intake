"use server";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit, userCanSeeProgram, userHasCap } from "@/lib/access";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Mark a not-done milestone complete; current advances to the next undone one. */
export async function completeMilestone(projectId: string, milestoneId: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "construction")) return { ok: false, message: "No access to construction projects." };

  const project = (await db.select().from(t.projects).where(eq(t.projects.id, projectId)))[0];
  if (!project || !await userCanSeeProgram(user, project.programId)) return { ok: false, message: "Project not found." };

  const milestones = await db.select().from(t.projectMilestones)
    .where(eq(t.projectMilestones.projectId, projectId))
    .orderBy(asc(t.projectMilestones.sort))
    ;
  const target = milestones.find((m) => m.id === milestoneId);
  if (!target) return { ok: false, message: "Milestone not found." };
  if (target.done === 1) return { ok: false, message: "Milestone is already complete." };

  const firstUndone = milestones.find((m) => m.done !== 1);
  if (!(target.current === 1 || target.id === firstUndone?.id)) {
    return { ok: false, message: "Complete earlier milestones first." };
  }

  // mark done, then move "current" to the next undone milestone in order
  await db.update(t.projectMilestones).set({ done: 1, current: 0 })
    .where(eq(t.projectMilestones.id, target.id));
  await db.update(t.projectMilestones).set({ current: 0 })
    .where(eq(t.projectMilestones.projectId, projectId));
  const next = milestones.find((m) => m.done !== 1 && m.id !== target.id);
  if (next) {
    await db.update(t.projectMilestones).set({ current: 1 })
      .where(eq(t.projectMilestones.id, next.id));
  }

  // recompute project % complete = done / total, rounded
  const doneCount = milestones.filter((m) => m.done === 1 || m.id === target.id).length;
  const pct = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0;
  await db.update(t.projects).set({ pct }).where(eq(t.projects.id, projectId));

  await audit(user.id, "project.milestone.complete", "project", projectId,
    `${target.label} — ${pct}% complete`);
  revalidatePath("/tools/projects");
  return { ok: true, message: `Milestone complete — ${target.label}. Project now ${pct}% complete.` };
}

/** Assign a due compliance requirement to the program manager (task hand-off). */
export async function assignRequirement(requirementId: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!await userHasCap(user, "construction")) return { ok: false, message: "No access to construction projects." };

  const req = (await db.select().from(t.projectRequirements)
    .where(eq(t.projectRequirements.id, requirementId)))[0];
  if (!req) return { ok: false, message: "Requirement not found." };
  const project = (await db.select().from(t.projects).where(eq(t.projects.id, req.projectId)))[0];
  if (!project || !await userCanSeeProgram(user, project.programId)) return { ok: false, message: "Requirement not found." };

  await audit(user.id, "project.requirement.assign", "project_requirement", String(req.id),
    `${project.name} — ${req.label}`);
  revalidatePath("/tools/projects");
  return { ok: true, message: "Requirement task assigned to the program manager." };
}
