"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DetectorBadge from "@/components/DetectorBadge";
import PageHeader from "@/components/PageHeader";
import ScopeNote from "@/components/ScopeNote";
import { DecisionTag, OutcomeTag } from "@/components/Tags";
import { Analysis, Stats, getStats, listAnalyses } from "@/lib/api";
import { DETECTORS, DetectorId } from "@/lib/detectors";
import { amountOf, fmtAmount, fmtDateTime, pct } from "@/lib/format";
import { redirectIfLoggedOut, useConsole } from "@/lib/session";

function Tile({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl font-medium tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </>
  );
  const cls = "block rounded-md border border-line bg-white px-5 py-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-muted`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function OverviewPage() {
  const { scope } = useConsole();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Analysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const type = scope === "all" ? undefined : scope;
    setStats(null);
    Promise.all([getStats(type ?? null, 30), listAnalyses({ fraud_type: type, limit: 5 })])
      .then(([s, list]) => {
        if (cancelled) return;
        setStats(s);
        setRecent(list.items);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled && !redirectIfLoggedOut(e)) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Overview">
        A summary of the transactions you have checked. <ScopeNote />
      </PageHeader>

      {error && <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!stats && !error && <div className="h-40 animate-pulse rounded-md border border-line bg-white" />}

      {stats && stats.total === 0 && (
        <div className="rounded-md border border-dashed border-line bg-white px-6 py-10 text-center">
          <h2 className="text-base font-semibold">Nothing checked yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Check your first transaction and it will appear here, in History and in Analytics.
          </p>
          <Link href="/analyze" className="mt-5 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft">
            Check a transaction
          </Link>
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Checked in the last 7 days" value={stats.last_7_days.toLocaleString("en-US")} note={`${stats.total.toLocaleString("en-US")} in total`} />
            <Tile label="Sent for review" value={stats.review.toLocaleString("en-US")} note={`${pct(stats.review, stats.total)} of all checks`} />
            <Tile label="Approved" value={stats.approve.toLocaleString("en-US")} note={`${pct(stats.approve, stats.total)} of all checks`} />
            <Tile
              label="Flagged, outcome not recorded"
              value={stats.awaiting_outcome.toLocaleString("en-US")}
              note={stats.awaiting_outcome ? "Open History to record them" : "All flagged cases have an outcome"}
              href={stats.awaiting_outcome ? "/history?show=pending-review" : undefined}
            />
          </div>

          {scope === "all" && stats.by_detector.length > 0 && (
            <section className="rounded-md border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">By detector</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-5 py-2 font-medium">Detector</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Checks</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Review</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_detector.map((d) => (
                    <tr key={d.fraud_type} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-2.5">{d.fraud_type in DETECTORS ? <DetectorBadge id={d.fraud_type as DetectorId} /> : d.fraud_type}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">{d.total.toLocaleString("en-US")}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">{d.review.toLocaleString("en-US")}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">{d.approve.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <p className="border-t border-line px-5 py-3 text-xs text-muted">Counts only. Scores from different detectors are not compared, because they mean different things.</p>
            </section>
          )}

          <section className="rounded-md border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold">Latest checks</h2>
              <Link href="/history" className="text-xs font-medium underline underline-offset-2">See all in History</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-5 py-2 font-medium">When</th>
                    <th scope="col" className="px-5 py-2 font-medium">Detector</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Amount</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Score</th>
                    <th scope="col" className="px-5 py-2 font-medium">Decision</th>
                    <th scope="col" className="px-5 py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">{fmtDateTime(a.created_at)}</td>
                      <td className="px-5 py-2.5">{a.fraud_type in DETECTORS ? <DetectorBadge id={a.fraud_type as DetectorId} /> : a.fraud_type}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">{fmtAmount(amountOf(a))}</td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">{a.risk_score.toFixed(4)}</td>
                      <td className="px-5 py-2.5"><DecisionTag decision={a.decision} /></td>
                      <td className="px-5 py-2.5"><OutcomeTag outcome={a.outcome} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
