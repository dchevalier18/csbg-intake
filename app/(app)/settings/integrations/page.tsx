import { requireAdmin } from "@/lib/auth";
import { orgFY } from "@/lib/access";
import { kvGet } from "@/lib/data/core";
import {
  CTAPI_BASE_URL, getHmisConfig, hmisConfig, hmisKeysUnreadable, normalizeDateRange,
  type HmisStoredConfig,
} from "@/lib/hmis";
import { IntegrationsClient, type HmisSettingsView } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  await requireAdmin();

  const stored = await kvGet<Partial<HmisStoredConfig>>("hmisConn", {});
  const { source } = await getHmisConfig();

  // Only ever booleans for the keys — the ciphertext stays server-side too.
  // The procedure name and its parameters are not secrets and round-trip.
  const params = stored.storedProcedureParams ?? {};
  const dateRange = normalizeDateRange(stored.dateRange);
  // the agency's FY window, so the form can show what "fiscal year to date"
  // actually resolves to here instead of leaving it abstract
  const fy = await orgFY();
  const view: HmisSettingsView = {
    baseUrl: stored.baseUrl ?? CTAPI_BASE_URL,
    hasSubscriptionKey: Boolean(stored.subscriptionKey),
    hasApiKey: Boolean(stored.apiKey),
    orgId: stored.orgId ?? "",
    pageSize: stored.pageSize ?? 200,
    storedProcedure: stored.storedProcedure ?? "",
    storedProcedureParams: JSON.stringify(params, null, 2),
    dateRange,
    fyLabel: fy.label,
    fyStartIso: fy.start,
    todayIso: new Date().toISOString().slice(0, 10),
    source,
    envConfigured: hmisConfig() !== null,
    keysUnreadable: await hmisKeysUnreadable(),
  };

  return <IntegrationsClient initial={view} />;
}
