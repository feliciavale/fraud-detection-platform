"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import DetectorBadge from "@/components/DetectorBadge";
import PageHeader from "@/components/PageHeader";
import ResultPanel from "@/components/ResultPanel";
import ScopeNote from "@/components/ScopeNote";
import { DecisionTag, OutcomeTag } from "@/components/Tags";
import { Analysis, Outcome, deleteAnalysis, getSchema, listAnalyses, setOutcome } from "@/lib/api";
import { DETECTORS, DetectorId, FEATURE_LABELS } from "@/lib/detectors";
import { amountOf, fmtAmount, fmtDateTime, fmtValue } from "@/lib/format";
import { redirectIfLoggedOut, useConsole } from "@/lib/session";

const PAGE_SIZE = 25;
const selectClass = "h-8 rounded-md border border-line bg-white px-2 text-sm focus:border-ink focus:outline-none";
const smallButton = "h-7 rounded-md border border-line bg-white px-2.5 text-xs font-medium hover:bg-canvas disabled:opacity-50";

type DecisionFilter = "" | "review" | "approve";
type OutcomeFilter = "" | "pending" | "fraud" | "not_fraud";

/** Buttons to record what really happened. This is what makes the accuracy numbers in Analytics possible. */
function OutcomeButtons({ a, busy, onSet }: { a: Analysis; busy: boolean; onSet: (o: Outcome | null) => void }) {
  if (a.outcome) {
    return (
      <span className="flex items-center gap-2">
        <OutcomeTag outcome={a.outcome} />
        <button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-ink" disabled={busy} onClick={() => onSet(null)}>
          Undo
        </button>
      </span>
    );
  }
  return (
    <span className="flex gap-1.5" role="group" aria-label="Record the outcome">
      <button type="button" className={smallButton} disabled={busy} onClick={() => onSet("fraud")}>Fraud</button>
      <button type="button" className={smallButton} disabled={busy} onClick={() => onSet("not_fraud")}>Not fraud</button>
    </span>
  );
}

export default function HistoryPage() {
  const { scope } = useConsole();
  const [decision, setDecision] = useState<DecisionFilter>("");
  const [outcome, setOutcomeFilter] = useState<OutcomeFilter>("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; items: Analysis[] } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>(FEATURE_LABELS);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A link from Overview can preselect "flagged, outcome not recorded".
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("show") === "pending-review") {
      setDecision("review");
      setOutcomeFilter("pending");
    }
  }, []);

  // Field labels from both detectors' schemas, for the "What was entered" list.
  useEffect(() => {
    Promise.all((Object.keys(DETECTORS) as DetectorId[]).map((id) => getSchema(id).catch(() => null))).then((schemas) => {
      const m: Record<string, string> = { ...FEATURE_LABELS };
      schemas.forEach((s) => s?.fields.forEach((f) => f.label && (m[f.name] = f.label)));
      setLabels(m);
    });
  }, []);

  const latest = useRef(0);
  const load = useCallback(() => {
    const req = ++latest.current; // ignore answers to older requests
    listAnalyses({
      fraud_type: scope === "all" ? undefined : scope,
      decision,
      outcome,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((d) => {
        if (req !== latest.current) return;
        setData(d);
        setError(null);
      })
      .catch((e) => req === latest.current && !redirectIfLoggedOut(e) && setError(e.message));
  }, [scope, decision, outcome, page]);

  useEffect(load, [load]);

  // The detector switcher changed: go back to the first page.
  useEffect(() => setPage(0), [scope]);
  const filterDecision = (v: DecisionFilter) => { setDecision(v); setPage(0); };
  const filterOutcome = (v: OutcomeFilter) => { setOutcomeFilter(v); setPage(0); };

  async function record(a: Analysis, value: Outcome | null) {
    setBusy(a.id);
    try {
      const updated = await setOutcome(a.id, value);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === a.id ? updated : x)) });
    } catch (e) {
      if (!redirectIfLoggedOut(e)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Analysis) {
    setBusy(a.id);
    try {
      await deleteAnalysis(a.id);
      setOpen(null);
      setConfirmDelete(null);
      load();
    } catch (e) {
      if (!redirectIfLoggedOut(e)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const total = data?.total ?? 0;
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="History">
        Every transaction you have checked, newest first. When you find out what really happened, mark it as <b className="font-medium text-ink">Fraud</b> or{" "}
        <b className="font-medium text-ink">Not fraud</b>; Analytics uses these to show how often the decisions were right. <ScopeNote />
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="text-xs font-medium text-muted">
          Decision
          <select className={`${selectClass} mt-1 block`} value={decision} onChange={(e) => filterDecision(e.target.value as DecisionFilter)}>
            <option value="">All</option>
            <option value="review">Review</option>
            <option value="approve">Approve</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Outcome
          <select className={`${selectClass} mt-1 block`} value={outcome} onChange={(e) => filterOutcome(e.target.value as OutcomeFilter)}>
            <option value="">All</option>
            <option value="pending">Not checked yet</option>
            <option value="fraud">Confirmed fraud</option>
            <option value="not_fraud">Not fraud</option>
          </select>
        </label>
        {(decision || outcome) && (
          <button type="button" className="h-8 text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => { filterDecision(""); filterOutcome(""); }}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!data && !error && <div className="h-64 animate-pulse rounded-md border border-line bg-white" />}

      {data && data.total === 0 && (
        <div className="rounded-md border border-dashed border-line bg-white px-6 py-10 text-center text-sm text-muted">
          {decision || outcome ? "No checks match these filters." : "No checks yet. Analyze a transaction and it will appear here."}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="rounded-md border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">When</th>
                  <th scope="col" className="px-4 py-2 font-medium">Detector</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
                  <th scope="col" className="px-4 py-2 font-medium">Decision</th>
                  <th scope="col" className="px-4 py-2 font-medium">Was it fraud?</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => {
                  const isOpen = open === a.id;
                  const known = a.fraud_type in DETECTORS;
                  return (
                    <Fragment key={a.id}>
                      <tr className={`border-b border-line ${isOpen ? "bg-canvas" : ""}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDateTime(a.created_at)}</td>
                        <td className="px-4 py-2.5">{known ? <DetectorBadge id={a.fraud_type as DetectorId} /> : a.fraud_type}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtAmount(amountOf(a))}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{a.risk_score.toFixed(4)}</td>
                        <td className="px-4 py-2.5"><DecisionTag decision={a.decision} /></td>
                        <td className="px-4 py-2.5"><OutcomeButtons a={a} busy={busy === a.id} onSet={(o) => record(a, o)} /></td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`details-${a.id}`}
                            className="text-xs font-medium underline underline-offset-2"
                            onClick={() => { setOpen(isOpen ? null : a.id); setConfirmDelete(null); }}
                          >
                            {isOpen ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr id={`details-${a.id}`} className="border-b border-line bg-canvas">
                          <td colSpan={7} className="px-4 py-5">
                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                              <div className="space-y-5">
                                <section className="rounded-md border border-line bg-white px-5 py-4">
                                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">What was entered</h3>
                                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[12rem_1fr]">
                                    {Object.entries(a.input).map(([k, v]) => (
                                      <div key={k} className="contents">
                                        <dt className="text-muted">{labels[k] ?? k}</dt>
                                        <dd className="font-mono">{fmtValue(v)}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                  <p className="mt-3 text-xs text-muted">Fields left empty are not listed. Checked {fmtDateTime(a.created_at)}.</p>
                                </section>
                                <section className="rounded-md border border-line bg-white px-5 py-4">
                                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Remove this check</h3>
                                  {confirmDelete === a.id ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                      <span>Delete it permanently?</span>
                                      <button type="button" className="h-7 rounded-md bg-red-700 px-3 text-xs font-medium text-white hover:bg-red-800" disabled={busy === a.id} onClick={() => remove(a)}>
                                        Delete
                                      </button>
                                      <button type="button" className={smallButton} onClick={() => setConfirmDelete(null)}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button type="button" className={`${smallButton} mt-2`} onClick={() => setConfirmDelete(a.id)}>
                                      Delete this check
                                    </button>
                                  )}
                                </section>
                              </div>
                              {known && <ResultPanel detector={a.fraud_type as DetectorId} data={a} labels={labels} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
            <span>
              Showing {from.toLocaleString("en-US")} to {to.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
            </span>
            <span className="flex gap-2">
              <button type="button" className={smallButton} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button type="button" className={smallButton} disabled={to >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
