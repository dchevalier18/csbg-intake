import { requireAdmin } from "@/lib/auth";
import { db, t } from "@/db";
import { getPrograms } from "@/lib/access";
import { getStaff } from "@/lib/data/core";
import { UsersClient } from "./users-client";

export default async function UsersSettingsPage() {
  const user = await requireAdmin();
  const staff = getStaff();
  const assignments = db.select().from(t.userPrograms).all();
  const users = staff.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    initials: u.initials,
    access: u.access,
    programs: assignments.filter((a) => a.userId === u.id).map((a) => a.programId),
  }));
  const programs = getPrograms().map((p) => ({ id: p.id, short: p.short, color: p.color }));
  return <UsersClient users={users} programs={programs} currentUserId={user.id} />;
}
