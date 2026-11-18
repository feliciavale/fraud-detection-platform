import type { Metadata } from "next";
import DetectorBadge from "@/components/DetectorBadge";
import PageHeader from "@/components/PageHeader";
import { DETECTORS, DetectorId, PlainResult } from "@/lib/detectors";

export const metadata: Metadata = { title: "Model performance" };

const TERMS: [string, string][] = [
  ["Caught", "A fraud the model sent for review. This is what you want."],
  ["Missed", "A fraud the model approved. It got through."],
  ["False alarm", "A normal transaction the model sent for review. A real customer is held up for nothing."],
];

/** One result as a sentence and a bar showing the share. */
function ResultRow({ r }: { r: PlainResult }) {
  const share = r.part / r.whole;
  const percent = share * 100;
  // One decimal near 0% and 100%, so 1,263 of 1,264 does not read as "100%" (all of them).
  const shown = percent < 1 || (percent > 99 && percent < 100) ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">{r.label}</h4>
        <span className="text-xs text-muted">{r.good === "high" ? "Higher is better" : "Lower is better"}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2.5 flex-1 bg-canvas" role="img" aria-label={`${shown}`}>
          <div className="h-2.5 rounded-r-sm bg-ink" style={{ width: `${Math.max(percent, 0.4)}%` }} />
        </div>
        <span className="w-12 text-right font-mono text-sm tabular-nums">{shown}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted">{r.sentence}</p>
    </div>
  );
}

export default function PerformancePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="How well do the models work?">
        Before being used here, each model was tested on transactions it had never seen, where the right answer was already known.
        This page shows those test results in plain numbers. They are not results from the transactions you check here; for those,
        see Analytics.
      </PageHeader>

      <section className="mb-8 rounded-md border border-line bg-white px-5 py-4">
        <h2 className="text-sm font-semibold">Three words used on this page</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {TERMS.map(([term, meaning]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="mt-0.5 text-muted">{meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Every fraud model trades these off. Flagging more transactions catches more fraud but also raises more false alarms.
        </p>
      </section>

      <div className="space-y-8">
        {(Object.keys(DETECTORS) as DetectorId[]).map((id) => {
          const d = DETECTORS[id];
          return (
            <section key={id} className="rounded-md border border-line bg-white" aria-labelledby={`${id}-title`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4" style={{ borderTop: `3px solid ${d.accent}` }}>
                <h2 id={`${id}-title`} className="text-base font-semibold">{d.plainName}</h2>
                <DetectorBadge id={id} />
              </div>

              {/* Verdict in one line, then the explanation */}
              <div className="border-b border-line px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">In short</div>
                <p className="mt-1 text-base font-semibold">{d.verdict.rating}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{d.verdict.text}</p>
              </div>

              {/* The three results */}
              <div className="px-5 pt-2">
                <h3 className="sr-only">Test results</h3>
                <p className="pt-2 text-xs text-muted">Tested on {d.testSize}</p>
                <div className="divide-y divide-line">
                  {d.plain.map((r) => (
                    <ResultRow key={r.label} r={r} />
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div className="border-t border-line px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Keep in mind</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {d.limits.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>

              {/* Technical details for readers who want the original metrics */}
              <details className="group border-t border-line">
                <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium hover:bg-canvas">
                  <span className="mr-2 inline-block font-mono text-muted transition-transform group-open:rotate-90" aria-hidden="true">&gt;</span>
                  Technical details
                </summary>
                <div className="space-y-6 px-5 pb-5 pt-2">
                  <p className="text-xs leading-relaxed text-muted">
                    <b className="text-ink">PR-AUC</b> measures how well the model puts fraud above normal transactions when sorting them by
                    score, from 0 to 1 (1 is perfect; random guessing scores about the share of fraud in the data).{" "}
                    <b className="text-ink">Recall at 1% FPR</b> is the share of fraud caught if only 1 in 100 normal transactions may be flagged.
                  </p>

                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-4">
                    {d.metrics.map((m) => (
                      <div key={m.label} className="bg-white px-4 py-3">
                        <dt className="text-xs text-muted">{m.label}</dt>
                        <dd className="mt-1 font-mono text-lg font-medium tabular-nums">{m.value}</dd>
                        {m.hint && <dd className="mt-0.5 text-xs text-muted">{m.hint}</dd>}
                      </div>
                    ))}
                  </dl>

                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
                    {d.facts.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">Models compared during development</caption>
                      <thead>
                        <tr className="border-b border-line text-xs text-muted">
                          <th scope="col" className="py-2 pr-4 font-medium">Model</th>
                          <th scope="col" className="py-2 pr-4 text-right font-medium">PR-AUC</th>
                          <th scope="col" className="py-2 text-right font-medium">Recall at 1% FPR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.compared.map((c) => (
                          <tr key={c.model} className={`border-b border-line last:border-b-0 ${c.final ? "bg-canvas" : ""}`}>
                            <td className="py-2.5 pr-4">
                              <span className={c.final ? "font-medium" : ""}>{c.model}</span>
                              {c.final && (
                                <span className="ml-2 rounded border border-ink px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider">In use</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{c.prauc}</td>
                            <td className="py-2.5 text-right font-mono tabular-nums">{c.recall}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        The two detectors were tested on different data, so their results should not be compared with each other. The phone wallet
        detector&apos;s results look better mainly because its simulated data is much easier.
      </p>
    </div>
  );
}
