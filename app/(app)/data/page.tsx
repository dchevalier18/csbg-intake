import { db, t } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { kvGet } from "@/lib/data/core";
import { DataClient, type MatchingStats } from "./data-client";

export default async function DataPage() {
  await requireAdmin();

  const integrations = db.select().from(t.integrations).all();
  const matching = kvGet<MatchingStats>("matching", { auto: 0, staff: 0, awaiting: 0, silent: 0 });

  return (
    <DataClient
      integrations={integrations.map((x) => ({
        id: x.id,
        name: x.name,
        kind: x.kind,
        status: x.status,
        lastSync: x.lastSync,
        records: x.records,
        detail: x.detail,
      }))}
      matching={matching}
    />
  );
}
