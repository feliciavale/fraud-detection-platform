"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DetectorBadge from "@/components/DetectorBadge";
import PageHeader from "@/components/PageHeader";
import ResultPanel from "@/components/ResultPanel";
import { Analysis, Field, Schema, createAnalysis, getSchema, getTypes } from "@/lib/api";
import { DETECTORS, DetectorId, FEATURE_LABELS } from "@/lib/detectors";
import { redirectIfLoggedOut } from "@/lib/session";

// Shared class strings. Edit these to restyle every input or button on the page at once.
const inputClass =
  "mt-1.5 block h-9 w-full rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15";
const primaryButton =
  "h-9 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "h-8 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50";

export default function AnalyzePage() {
  const [available, setAvailable] = useState<DetectorId[]>([]);
  const [detector, setDetector] = useState<DetectorId | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ detector: DetectorId; data: Analysis } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Ask the API which detectors exist, keep the ones the dashboard has a config for.
  useEffect(() => {
    getTypes()
      .then((t) => {
        const ids = (Object.keys(DETECTORS) as DetectorId[]).filter((id) => t.includes(id));
        setAvailable(ids);
        if (ids.length) setDetector(ids[0]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // 2. When the detector changes, fetch its form fields and reset the form and the result.
  useEffect(() => {
    if (!detector) return;
    let cancelled = false;
    setSchema(null);
    setResult(null);
    setError(null);
    getSchema(detector)
      .then((s) => {
        if (cancelled) return;
        setSchema(s);
        setValues({ ...DETECTORS[detector].defaults });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [detector]);

  // Display names: labels from the API win over FEATURE_LABELS in lib/detectors.ts.
  const labels = useMemo(() => {
    const m: Record<string, string> = { ...FEATURE_LABELS };
    schema?.fields.forEach((f) => {
      if (f.label) m[f.name] = f.label;
    });
    return m;
  }, [schema]);

  // Field groups come from lib/detectors.ts. Fields not listed there go into "Other".
  const groups = useMemo(() => {
    if (!schema || !detector) return [];
    const cfg = DETECTORS[detector].groups;
    if (!cfg) return [{ title: "Transaction", fields: schema.fields }];
    const used = new Set(cfg.flatMap((g) => g.fields));
    const out = cfg
      .map((g) => ({ title: g.title, fields: schema.fields.filter((f) => g.fields.includes(f.name)) }))
      .filter((g) => g.fields.length);
    const rest = schema.fields.filter((f) => !used.has(f.name));
    if (rest.length) out.push({ title: "Other", fields: rest });
    return out;
  }, [schema, detector]);

  // 3. Send only filled-in fields. Empty optional fields are left out so the model treats them as missing.
  //    The API scores the transaction and saves it to this user's history.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!schema || !detector || loading) return;
    const payload: Record<string, string | number> = {};
    for (const f of schema.fields) {
      const v = values[f.name];
      if (v === undefined || v === "") continue;
      payload[f.name] = f.kind === "number" ? Number(v) : v;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult({ detector, data: await createAnalysis(detector, payload) });
    } catch (err) {
      if (redirectIfLoggedOut(err)) return;
      setError(err instanceof Error ? err.message : "Scoring failed.");
    } finally {
      setLoading(false);
    }
  }

  function renderField(f: Field) {
    const required = f.required ?? true;
    const set = (v: string) => setValues((prev) => ({ ...prev, [f.name]: v }));
    const help = detector ? DETECTORS[detector].help[f.name] : undefined;
    const helpId = help ? `help-${f.name}` : undefined;
    return (
      <label key={f.name} className="block text-xs font-medium text-ink">
        {labels[f.name] ?? f.name}
        {required ? <span className="text-ink"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
        {f.kind === "select" ? (
          <select className={inputClass} required={required} aria-describedby={helpId} value={values[f.name] ?? ""} onChange={(e) => set(e.target.value)}>
            <option value="">{required ? "Select" : "(not provided)"}</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            className={`${inputClass} font-mono`}
            type="number"
            step="any"
            required={required}
            aria-describedby={helpId}
            placeholder={required ? "" : "not provided"}
            value={values[f.name] ?? ""}
            onChange={(e) => set(e.target.value)}
          />
        )}
        {help && (
          <span id={helpId} className="mt-1 block font-normal leading-relaxed text-muted">
            {help}
          </span>
        )}
      </label>
    );
  }

  const cfg = detector ? DETECTORS[detector] : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Analyze a transaction">
        Choose the kind of payment, fill in what is known before it is approved, and get a decision with the reasons. Each
        check is saved to your History.
      </PageHeader>

      {/* Detector selector */}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Kind of payment">
        {available.map((id) => {
          const d = DETECTORS[id];
          const active = id === detector;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={loading}
              onClick={() => setDetector(id)}
              className="rounded-md border bg-white p-4 text-left transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-60"
              style={active ? { borderColor: d.accent, boxShadow: `inset 0 0 0 1px ${d.accent}` } : { borderColor: "var(--color-line)" }}
            >
              <div className="flex items-center justify-between">
                <DetectorBadge id={id} />
                <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: active ? d.accent : "var(--color-line)" }} aria-hidden="true">
                  {active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.accent }} />}
                </span>
              </div>
              <div className="mt-3 text-sm font-medium">{d.plainName}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{d.summary}</p>
            </button>
          );
        })}
      </div>

      {error && !schema && (
        <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column: the form */}
        {cfg && schema ? (
          <form onSubmit={submit} className="rounded-md border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold">Transaction details</h2>
              <div className="flex gap-2">
                {cfg.example && (
                  <button type="button" onClick={() => setValues({ ...cfg.example })} className={secondaryButton} disabled={loading}>
                    Fill in an example fraud
                  </button>
                )}
                <button type="button" onClick={() => setValues({ ...cfg.defaults })} className={secondaryButton} disabled={loading}>
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-6 px-5 py-5">
              <p className="text-xs leading-relaxed text-muted">{cfg.formHint} Fields marked * are required.</p>
              {groups.map((g) => (
                <fieldset key={g.title}>
                  <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</legend>
                  <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{g.fields.map(renderField)}</div>
                </fieldset>
              ))}
            </div>

            <div className="flex items-center justify-end border-t border-line bg-canvas/60 px-5 py-3">
              <button type="submit" disabled={loading} className={primaryButton}>
                {loading ? "Checking" : "Check this transaction"}
              </button>
            </div>
          </form>
        ) : (
          detector && !error && <div className="h-96 animate-pulse rounded-md border border-line bg-white" />
        )}

        {/* Right column: the result, sticky on wide screens */}
        <div className="lg:sticky lg:top-10">
          {error && schema && (
            <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          {result ? (
            <ResultPanel
              detector={result.detector}
              data={result.data}
              labels={labels}
              footer={
                <p className="text-xs text-muted">
                  Saved to your{" "}
                  <Link href="/history" className="font-medium text-ink underline underline-offset-2">
                    History
                  </Link>
                  . Record there whether it turned out to be fraud.
                </p>
              }
            />
          ) : (
            cfg &&
            !error && (
              <div className="rounded-md border border-dashed border-line bg-white px-5 py-8 text-sm text-muted">
                <h2 className="font-semibold text-ink">No result yet</h2>
                <p className="mt-2 leading-relaxed">
                  {loading ? "Checking the transaction." : "Fill in the form and select Check this transaction. The decision and the reasons appear here."}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
