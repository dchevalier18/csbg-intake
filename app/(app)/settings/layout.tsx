import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { SettingsTabs } from "./tabs-nav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Settings<span className="red">.</span></h1>
          <p className="lede">
            Configure this workspace for your agency — brand, programs, people, poverty guidelines, and the intake form itself.
          </p>
        </div>
        <SettingsTabs />
      </div>
      {children}
    </div>
  );
}
