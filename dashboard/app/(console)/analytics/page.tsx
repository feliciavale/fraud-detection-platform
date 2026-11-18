"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ColumnChart } from "@/components/Charts";
import DetectorBadge from "@/components/DetectorBadge";
import PageHeader from "@/components/PageHeader";
import ScopeNote from "@/components/ScopeNote";
import { Stats, getStats } from "@/lib/api";
import { DETECTORS, DetectorId } from "@/lib/detectors";
import { fmtDay, pct } from "@/lib/format";
import { redirectIfLoggedOut, useConsole } from "@/lib/session";

const DAYS = 30;
/** Below this many recorded outcomes, rates are shown with a warning that they are not reliable yet. */
const MIN_RELIABLE = 20;

function Card({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {intro && <p className="mt-1 text-xs leading-relaxed text-muted">{intro}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/** The analyst outcomes as four plain sentences plus the two rates people ask about. */
function Accuracy({ s }: { s: Stats }) {
  const o = s.outcomes;
  const flaggedChecked = o.flagged_fraud + o.flagged_not_fraud;
  const approvedChecked = o.approved_fraud + o.approved_not_fraud;
  const recorded = flaggedChecked + approvedChecked;

  if (recorded === 0) {
    return (
      <p className="text-sm text-muted">
        No outcomes recorded yet. In{" "}
        <Link href="/history" className="font-medium text-ink underline underline-offset-2">History</Link>, mark checks as Fraud or Not fraud
        once you know, and this section will show how often the decisions were right.
      </p>
    );
  }

  const rows = [
    { label: "Sent for review, and it was fraud", value: o.flagged_fraud, meaning: "A correct catch." },
    { label: "Sent for review, but it was not fraud", value: o.flagged_not_fraud, meaning: "A false alarm: a normal customer was held up." },
    { label: "Approved, but it was fraud", value: o.approved_fraud, meaning: "A miss: fraud got through." },
    { label: "Approved, and it was not fraud", value: o.approved_not_fraud, meaning: "Correctly left alone." },
  ];

  return (
    <div className="space-y-5">
      {recorded < MIN_RELIABLE && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Based on only {recorded} recorded {recorded === 1 ? "outcome" : "outcomes"}. Percentages from so few cases can change a lot with the next few.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted">Of the flagged cases you checked, how many were really fraud</div>
          <div className="mt-1 font-mono text-2xl font-medium tabular-nums">{flaggedChecked ? pct(o.flagged_fraud, flaggedChecked) : "None yet"}</div>
          <div className="text-xs text-muted">{o.flagged_fraud} of {flaggedChecked} flagged cases with an outcome</div>
        </div>
        <div>
          <div className="text-xs text-muted">Of the approved cases you checked, how many were fraud after all</div>
          <div className="mt-1 font-mono text-2xl font-medium tabular-nums">{approvedChecked ? pct(o.approved_fraud, approvedChecked) : "None yet"}</div>
          <div className="text-xs text-muted">{o.approved_fraud} of {approvedChecked} approved cases with an outcome</div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-4 font-medium">What happened</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Cases</th>
            <th scope="col" className="py-2 font-medium">What it means</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-b-0">
              <td className="py-2 pr-4">{r.label}</td>
              <td className="py-2 pr-4 text-right font-mono tabular-nums">{r.value}</td>
              <td className="py-2 text-muted">{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-muted">
        Only cases where you recorded an outcome are counted. If you mostly check flagged cases, misses will be under-counted,
        because approved fraud is only found if someone looks at approved cases too.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { scope } = useConsole();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    getStats(scope === "all" ? null : scope, DAYS)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setError(null);
        }
      })
      .catch((e) => !cancelled && !redirectIfLoggedOut(e) && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const cfg = scope === "all" ? null : DETECTORS[scope];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Analytics">
        Patterns in the transactions you have checked, and how often the decisions turned out to be right. <ScopeNote />
      </PageHeader>

      {error && <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!stats && !error && <div className="h-64 animate-pulse rounded-md border border-line bg-white" />}

      {stats && stats.total === 0 && (
        <div className="rounded-md border border-dashed border-line bg-white px-6 py-10 text-center text-sm text-muted">
          Nothing to show yet.{" "}
          <Link href="/analyze" className="font-medium text-ink underline underline-offset-2">Check a transaction</Link> to get started.
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="space-y-6">
          <Card title={`Checks per day, last ${DAYS} days`} intro="How many transactions you checked each day, split by decision.">
            <ColumnChart
              title={`Checks per day, last ${DAYS} days`}
              unit="Checks"
              labelEvery={5}
              bars={stats.daily.map((d) => ({ label: fmtDay(d.date), review: d.review, approve: d.approve }))}
            />
          </Card>

          {cfg && stats.histogram ? (
            <>
              <Card
                title="How the scores are spread"
                intro={
                  <>
                    How many checks landed in each score range, from 0 (safest) to 1 (riskiest). Everything right of the amber line
                    ({cfg.threshold}) was sent for review. A big pile just under the line means many borderline cases.
                  </>
                }
              >
                <ColumnChart
                  title="Number of checks in each score range"
                  unit="Number of checks in each score range"
                  single="#14243A"
                  thresholdAt={Math.round(cfg.threshold * 10)}
                  thresholdLabel={`review from ${cfg.threshold}`}
                  bars={stats.histogram.map((b) => ({ label: `${b.from.toFixed(1)} to ${b.to.toFixed(1)}`, review: b.review, approve: b.approve }))}
                />
              </Card>

              <Card title="How often the decisions were right" intro="Based on the outcomes you recorded in History.">
                <Accuracy s={stats} />
              </Card>
            </>
          ) : (
            <section className="rounded-md border border-line bg-white px-5 py-5">
              <h2 className="text-sm font-semibold">Pick one detector for score charts and accuracy</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                The two detectors score in different ways, so their scores and accuracy are never combined. Choose{" "}
                {(Object.keys(DETECTORS) as DetectorId[]).map((id, i) => (
                  <span key={id}>
                    {i > 0 && " or "}
                    <DetectorBadge id={id} />
                  </span>
                ))}{" "}
                under <i>Show data for</i> in the sidebar.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
