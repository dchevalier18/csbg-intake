"use client";
/* Settings → Integrations — PA HMIS (ClientTrack API) connection form. Both key
   fields are write-only: they never round-trip to the browser, and leaving one
   blank keeps whatever is stored. */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip, Field, Notice, Panel } from "@/components/ui";
import { I } from "@/components/icons";
import { useToast } from "@/components/toast";
import { testHmisConnection } from "../../data/hmis-actions";
// @/lib/hmis-dates, NOT @/lib/hmis: the latter imports the database layer,
// which a client component must not pull into the browser bundle
import {
  DATE_RANGE_LABELS, DATE_RANGE_MODES, MAX_ROLLING_DAYS,
  type HmisDateRange, type HmisDateRangeMode,
} from "@/lib/hmis-dates";
import { clearHmisSettings, saveHmisSettings } from "./actions";

/** What the chosen mode will resolve to, computed in the browser purely to show
    the operator the window before they save. The value that actually gets sent
    is resolved server-side at sync time — this is a preview, not the source. */
function previewWindow(
  form: { dateRangeMode: string; dateStart: string; dateEnd: string; dateDays: string },
  fyStartIso: string,
  todayIso: string,
): { start: string; end: string } | null {
  const mode = form.dateRangeMode as HmisDateRangeMode;
  if (mode === "none") return null;
  if (mode === "fixed") {
    return form.dateStart && form.dateEnd ? { start: form.dateStart, end: form.dateEnd } : null;
  }
  if (mode === "fiscalYearToDate") return { start: fyStartIso, end: todayIso };
  if (mode === "calendarYearToDate") return { start: `${todayIso.slice(0, 4)}-01-01`, end: todayIso };
  const days = Number(form.dateDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  const [y, m, d] = todayIso.split("-").map(Number);
  const back = new Date(y, m - 1, d - days);
  const iso = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, "0")}-${String(back.getDate()).padStart(2, "0")}`;
  return { start: iso, end: todayIso };
}

export interface HmisSettingsView {
  baseUrl: string;
  hasSubscriptionKey: boolean;   // a key is stored (its value never leaves the server)
  hasApiKey: boolean;
  orgId: string;
  pageSize: number;
  storedProcedure: string;       // set = the client source; blank = CRQL query
  storedProcedureParams: string; // pretty-printed JSON object
  dateRange: HmisDateRange;
  fyLabel: string;               // e.g. "FY 2026" — what fiscal-year mode means here
  fyStartIso: string;            // that FY's start, for the resolved-window preview
  todayIso: string;
  source: "settings" | "environment" | null;
  envConfigured: boolean;        // HMIS_* environment variables would apply if cleared
  keysUnreadable: boolean;       // stored keys can't be decrypted on this server
}

export function IntegrationsClient({ initial }: { initial: HmisSettingsView }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [form, setForm] = useState({
    baseUrl: initial.baseUrl,
    subscriptionKey: "",
    apiKey: "",
    orgId: initial.orgId,
    pageSize: String(initial.pageSize || 200),
    storedProcedure: initial.storedProcedure,
    storedProcedureParams: initial.storedProcedureParams || "{}",
    dateRangeMode: initial.dateRange.mode as string,
    dateStartKey: initial.dateRange.startKey,
    dateEndKey: initial.dateRange.endKey,
    dateStart: initial.dateRange.start,
    dateEnd: initial.dateRange.end,
    dateDays: String(initial.dateRange.days || 90),
  });
  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const mode = form.dateRangeMode as HmisDateRangeMode;
  const window = previewWindow(form, initial.fyStartIso, initial.todayIso);
  const needsKeys = mode !== "none";
  const missingKeys = needsKeys && (!form.dateStartKey.trim() || !form.dateEndKey.trim());

  function onSave() {
    startTransition(async () => {
      const res = await saveHmisSettings(form);
      toast(res.message);
      if (res.ok) {
        setForm((f) => ({ ...f, subscriptionKey: "", apiKey: "" }));
        setResult(null);
        router.refresh();
      }
    });
  }
  function onTest() {
    startTransition(async () => {
      const res = await testHmisConnection();
      // shown in the panel rather than a toast: the procedure step reports the
      // column names it found, which is the point of running it
      setResult({ ok: res.ok, lines: res.lines });
      toast(res.message);
    });
  }
  function onClear() {
    startTransition(async () => {
      const res = await clearHmisSettings();
      toast(res.message);
      if (res.ok) router.refresh();
    });
  }

  const canSave = form.baseUrl.trim() !== ""
    && (form.subscriptionKey.trim() !== "" || initial.hasSubscriptionKey)
    && (form.apiKey.trim() !== "" || initial.hasApiKey);

  const keyHint = (stored: boolean, issued: string) =>
    stored ? "Stored — leave blank to keep it, or paste a new one to replace it." : issued;

  return (
    <Panel
      title="PA HMIS connection"
      sub="ClientTrack API credentials issued under the PA DCED MOU. Saved settings apply immediately — no server restart. Sync runs from Data & integrations."
      right={
        initial.source ? (
          <Chip tone={initial.source === "settings" ? "sage" : "teal"}>
            {initial.source === "settings" ? "Using saved settings" : "Using environment variables"}
          </Chip>
        ) : (
          <Chip tone="amber">Not configured</Chip>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <div className="fgrid c2">
          <Field label="API base URL" required hint="Production is the only environment Eccovia exposes.">
            <input value={form.baseUrl} onChange={set("baseUrl")} placeholder="https://api.clienttrack.net" />
          </Field>
          <Field label="Org ID" hint="User Keys only — scopes results to one organization.">
            <input value={form.orgId} onChange={set("orgId")} autoComplete="off" />
          </Field>
        </div>
        <div className="fgrid c2">
          <Field label="Subscription key" required={!initial.hasSubscriptionKey}
            hint={keyHint(initial.hasSubscriptionKey, "Sent as Ocp-Apim-Subscription-Key.")}>
            <input type="password" value={form.subscriptionKey} onChange={set("subscriptionKey")}
              placeholder={initial.hasSubscriptionKey ? "•••••••• (unchanged)" : ""} autoComplete="new-password" />
          </Field>
          <Field label="API key" required={!initial.hasApiKey}
            hint={keyHint(initial.hasApiKey, "Sent as Authorization: ApiKey …")}>
            <input type="password" value={form.apiKey} onChange={set("apiKey")}
              placeholder={initial.hasApiKey ? "•••••••• (unchanged)" : ""} autoComplete="new-password" />
          </Field>
        </div>
        <div className="fgrid c2">
          <Field label="Page size" hint="Records per CRQL page (default 200, CTAPI's maximum is 500). Applies to CRQL queries only — the stored-procedure endpoint takes no paging parameters.">
            <input type="number" min={1} max={500} value={form.pageSize} onChange={set("pageSize")} />
          </Field>
        </div>
        <div className="fgrid c2">
          <Field label="Stored procedure"
            hint="The schema prefix is optional — C_Report_Example and dbo.C_Report_Example both work, and the name is saved exactly as typed. Leave blank to sync with a CRQL query instead.">
            <input value={form.storedProcedure} onChange={set("storedProcedure")}
              placeholder="C_Report_Example_API" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Stored procedure parameters"
            hint="JSON object of the procedure's parameters. Leave as {} if it takes none.">
            <textarea value={form.storedProcedureParams} onChange={set("storedProcedureParams")}
              rows={3} spellCheck={false} style={{ fontFamily: "var(--calv-mono, monospace)", fontSize: 12.5 }} />
          </Field>
        </div>
        <div style={{ borderTop: "1px solid var(--calv-line, #e5e7eb)", paddingTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Date range</div>
          <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", marginBottom: 10 }}>
            Optional. Sends a reporting window to the stored procedure as two of its own
            parameters, resolved fresh on every sync — so a rolling or year-to-date window
            keeps moving instead of freezing on the day you saved it. Leave this off and the
            procedure&apos;s own internal filtering decides the period.
          </div>
          <div className="fgrid c2">
            <Field label="Window"
              hint="Fiscal year follows Settings → Organization, so it matches what Reports calls the current FY.">
              <select value={form.dateRangeMode} onChange={set("dateRangeMode")}>
                {DATE_RANGE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === "fiscalYearToDate" ? `${DATE_RANGE_LABELS[m]} (${initial.fyLabel})` : DATE_RANGE_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "rollingDays" ? (
              <Field label="Days back" hint={`Start = today minus this many days. 1 to ${MAX_ROLLING_DAYS}.`}>
                <input type="number" min={1} max={MAX_ROLLING_DAYS} value={form.dateDays} onChange={set("dateDays")} />
              </Field>
            ) : null}
          </div>
          {needsKeys ? (
            <>
              <div className="fgrid c2">
                <Field label="Start date parameter" required
                  hint="The procedure's own parameter name — we can't know it, so ask whoever wrote it.">
                  <input value={form.dateStartKey} onChange={set("dateStartKey")}
                    placeholder="StartDate" autoComplete="off" spellCheck={false} />
                </Field>
                <Field label="End date parameter" required hint="Must differ from the start parameter.">
                  <input value={form.dateEndKey} onChange={set("dateEndKey")}
                    placeholder="EndDate" autoComplete="off" spellCheck={false} />
                </Field>
              </div>
              {mode === "fixed" ? (
                <div className="fgrid c2">
                  <Field label="Start date" required>
                    <input type="date" value={form.dateStart} onChange={set("dateStart")} />
                  </Field>
                  <Field label="End date" required>
                    <input type="date" value={form.dateEnd} onChange={set("dateEnd")} />
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}
          {needsKeys ? (
            <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)", marginTop: 4 }}>
              {missingKeys ? (
                <>Enter both parameter names — without them no dates are sent at all.</>
              ) : window ? (
                <>
                  Next sync sends{" "}
                  <code>{form.dateStartKey.trim()}={window.start}</code>{" "}
                  and <code>{form.dateEndKey.trim()}={window.end}</code>
                  {mode === "fixed" ? null : <> — recalculated each run.</>}
                </>
              ) : (
                <>Fill in both dates to see the window this will send.</>
              )}
            </div>
          ) : null}
          {needsKeys && !form.storedProcedure.trim() ? (
            <Notice tone="sand">
              A date range only applies to a stored procedure. The CRQL query on <code>cmClient</code> has
              no <code>WHERE</code> clause, so while it is the client source this window is ignored.
            </Notice>
          ) : null}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>
          <strong>Client source:</strong>{" "}
          {initial.storedProcedure
            ? <>stored procedure <code>{initial.storedProcedure}</code></>
            : <>CRQL query on <code>cmClient</code></>}
          {form.storedProcedure.trim() !== initial.storedProcedure
            ? <> — changes when you save.</>
            : null}
        </div>
        <Notice tone="warn" icon="alert">
          Whatever is named here is <strong>executed</strong> against PA HMIS production when you
          sync or test. Eccovia&apos;s stored-procedure endpoint runs write procedures too
          (their own examples include <code>Merge_Client</code> and <code>Delete_Client</code>),
          and nothing in the API distinguishes them — only name a read-only report procedure.
        </Notice>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="calv-btn calv-btn--primary calv-btn--sm" disabled={!canSave || pending}
            style={!canSave || pending ? { opacity: 0.45, cursor: "not-allowed" } : undefined} onClick={onSave}>
            <I name="check" size={14} /> Save connection
          </button>
          <button className="calv-btn calv-btn--secondary calv-btn--sm" disabled={pending || !initial.source} onClick={onTest}>
            Test connection
          </button>
          {initial.hasSubscriptionKey || initial.hasApiKey ? (
            <button className="calv-btn calv-btn--quiet calv-btn--sm" disabled={pending} onClick={onClear}>
              Clear saved settings
            </button>
          ) : null}
          <span style={{ fontSize: 12.5, color: "var(--calv-slate-65)" }}>
            Sync itself runs from <Link className="tlink" href="/data">Data &amp; integrations</Link>.
          </span>
        </div>
        {result ? (
          <Notice tone={result.ok ? "good" : "warn"} icon={result.ok ? "check" : "alert"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {result.lines.map((line, i) => (
                <div key={i} style={{ overflowWrap: "anywhere" }}>{line}</div>
              ))}
            </div>
          </Notice>
        ) : null}
        {initial.keysUnreadable ? (
          <Notice tone="warn" icon="alert">
            The stored keys can&apos;t be decrypted on this server — the encryption key (data/secret.key,
            or CSBG_SECRET_KEY) has changed or is missing. Paste both keys again to re-save them.
          </Notice>
        ) : null}
        {initial.envConfigured ? (
          <Notice tone="sand">
            HMIS_* environment variables are also set on this server. Saved settings take precedence; Clear saved settings falls back to the environment values.
          </Notice>
        ) : null}
      </div>
    </Panel>
  );
}
