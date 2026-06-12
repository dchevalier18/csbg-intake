import { requireAdmin } from "@/lib/auth";
import { db, t } from "@/db";
import { asc } from "drizzle-orm";
import { getAllIntakeFields } from "@/lib/data/core";
import { FormsClient } from "./forms-client";

export default async function FormsSettingsPage() {
  await requireAdmin();
  const fields = (await getAllIntakeFields()).map((f) => ({
    id: f.id,
    label: f.label,
    code: f.code,
    type: f.type,
    listKey: f.listKey,
    optionsText: f.optionsText,
    enabled: f.enabled,
    builtin: f.builtin,
  }));
  const listRows = await db.select().from(t.lists);
  const valueRows = await db.select().from(t.listValues).orderBy(asc(t.listValues.sort));
  const lists = listRows.map((l) => ({
    key: l.key,
    label: l.label,
    values: valueRows.filter((v) => v.listKey === l.key).map((v) => ({ id: v.id, value: v.value })),
  }));
  return <FormsClient fields={fields} lists={lists} />;
}
