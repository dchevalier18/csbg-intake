import { asc, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { userHasCap, visiblePrograms } from "@/lib/access";
import { programType } from "@/lib/program-types";
import { Restricted } from "@/components/ui";
import { ProjectsClient, type ProjectDTO } from "./projects-client";

export default async function ProjectsPage() {
  const user = await requireUser();
  if (!userHasCap(user, "construction")) return <Restricted what="construction projects" />;

  // server-side scoping: only projects owned by a visible, construction-capable program
  const constructionPrograms = visiblePrograms(user)
    .filter((p) => programType(p.type).caps.includes("construction"));
  const programIds = constructionPrograms.map((p) => p.id);

  const projects = programIds.length
    ? db.select().from(t.projects).where(inArray(t.projects.programId, programIds)).all()
    : [];
  const projectIds = projects.map((p) => p.id);

  const milestones = projectIds.length
    ? db.select().from(t.projectMilestones)
        .where(inArray(t.projectMilestones.projectId, projectIds))
        .orderBy(asc(t.projectMilestones.sort))
        .all()
    : [];
  const requirements = projectIds.length
    ? db.select().from(t.projectRequirements)
        .where(inArray(t.projectRequirements.projectId, projectIds))
        .all()
    : [];

  const data: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    town: p.town,
    buyer: p.buyer,
    budget: p.budget,
    spent: p.spent,
    pct: p.pct,
    milestones: milestones
      .filter((m) => m.projectId === p.id)
      .map((m) => ({ id: m.id, label: m.label, done: m.done === 1, current: m.current === 1 })),
    requirements: requirements
      .filter((r) => r.projectId === p.id)
      .map((r) => ({ id: r.id, label: r.label, status: r.status })),
  }));

  return <ProjectsClient projects={data} programShort={constructionPrograms[0]?.short ?? "Construction"} />;
}
