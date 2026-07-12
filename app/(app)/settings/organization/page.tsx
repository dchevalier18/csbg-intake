import { requireAdmin } from "@/lib/auth";
import { getOrg } from "@/lib/data/core";
import { OrgSettingsClient } from "./org-client";

export default async function OrganizationSettingsPage() {
  await requireAdmin();
  const org = await getOrg();
  return (
    <OrgSettingsClient
      org={{
        name: org.name,
        short: org.short,
        tagline: org.tagline,
        region: org.region,
        accent: org.accent,
        logoMode: org.logoMode,
        logoData: org.logoData,
        fyStart: org.fyStart,
        csbgCeiling: org.csbgCeiling,
        incomeLookbackDays: org.incomeLookbackDays,
        contactLine: org.contactLine,
      }}
    />
  );
}
