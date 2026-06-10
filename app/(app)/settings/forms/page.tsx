import { requireAdmin } from "@/lib/auth";
import { db, t } from "@/db";
import { asc } from "drizzle-orm";
import { getAllIntakeFields } from "@/lib/data/core";
import { FormsClient } from "./forms-client";

export default async function FormsSettingsPage() {
  await requireAdmin();
  const fields = getAllIntakeFields().map((f) => ({
    id: f.id,
    label: f.label,
    code: f.code,
    type: f.type,
    listKey: f.listKey,
    optionsText: f.optionsText,
    enabled: f.enabled,
    builtin: f.builtin,
  }));
  const listRows = db.select().from(t.lists).all();
  const valueRows = db.select().from(t.listValues).orderBy(asc(t.listValues.sort)).all();
  const lists = listRows.map((l) => ({
    key: l.key,
    label: l.label,
    values: valueRows.filter((v) => v.listKey === l.key).map((v) => ({ id: v.id, value: v.value })),
  }));
  return <FormsClient fields={fields} lists={lists} />;
}
