import DetectorBadge from "@/components/DetectorBadge";
import type { ScoreResult } from "@/lib/api";
import { DETECTORS, DetectorId, FEATURE_LABELS } from "@/lib/detectors";
import { fmtValue } from "@/lib/format";

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
      <path d={up ? "M5 1 L9 8 H1 Z" : "M5 9 L9 2 H1 Z"} fill="currentColor" />
    </svg>
  );
}

/**
 * Shows one scored transaction: the decision in plain words, the score on a 0 to 1 bar,
 * and the three inputs that moved the score most.
 * Used on Analyze (new result), History (saved result) and the landing page (example).
 */
export default function ResultPanel({
  detector,
  data,
  labels = FEATURE_LABELS,
  footer,
}: {
  detector: DetectorId;
  data: ScoreResult;
  labels?: Record<string, string>;
  footer?: React.ReactNode;
}) {
  const cfg = DETECTORS[detector];
  const review = data.decision === "review";
  const shortcut = data.top_reasons.length === 1 && data.top_reasons[0].note;
  const maxImpact = Math.max(0.0001, ...data.top_reasons.map((r) => Math.abs(r.impact ?? 0)));

  return (
    <section className="rounded-md border border-line bg-white" aria-live="polite">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold">Result</h2>
        <DetectorBadge id={detector} />
      </div>

      {/* Decision in plain words, then the score */}
      <div className="px-5 py-5">
        <div className={`rounded-md border px-4 py-3 ${review ? "border-amber-300 bg-amber-50 text-amber-950" : "border-green-300 bg-green-50 text-green-950"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider">Decision</span>
            <span className="text-base font-semibold">{review ? "Review" : "Approve"}</span>
          </div>
          <p className="mt-1 text-sm">
            {review
              ? "This looks risky. Hold it and have someone check it before it goes through."
              : "No strong warning signs. It can go ahead."}
          </p>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted">Risk score</span>
          <span className="font-mono text-3xl font-medium tabular-nums">{data.risk_score.toFixed(4)}</span>
        </div>
        <div className="relative mt-3 h-2 bg-canvas" role="img" aria-label={`Risk score ${data.risk_score.toFixed(4)} out of 1. Review threshold ${cfg.threshold}.`}>
          <div className="h-2 bg-ink" style={{ width: `${Math.min(data.risk_score, 1) * 100}%` }} />
          <div className="absolute -top-1 h-4 w-0.5 bg-amber-500" style={{ left: `${cfg.threshold * 100}%` }} />
        </div>
        <div className="relative mt-1 h-4 font-mono text-[11px] text-muted" aria-hidden="true">
          <span className="absolute left-0">0 safer</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${cfg.threshold * 100}%` }}>{cfg.threshold}</span>
          <span className="absolute right-0">riskier 1</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Scores at or above the amber line ({cfg.threshold}) are sent for review. The score ranks how unusual a transaction
          looks; it is not a percentage chance of fraud.
        </p>
      </div>

      {/* Why: reasons, or the rule-based shortcut note */}
      <div className="border-t border-line px-5 py-5">
        {shortcut ? (
          <div className="rounded-md border border-line bg-canvas px-4 py-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Approved by a fixed rule</div>
            <p className="mt-1">{data.top_reasons[0].note}. The model was not run for this transaction.</p>
          </div>
        ) : (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">What moved the score</h3>
            <p className="mt-1 text-xs text-muted">Red pushed the score up, green pushed it down. A longer bar means a bigger effect.</p>
            <ul className="mt-4 space-y-4">
              {data.top_reasons.map((r) => {
                const impact = r.impact ?? 0;
                const raises = impact > 0;
                const color = raises ? "var(--color-raise)" : "var(--color-lower)";
                return (
                  <li key={r.feature}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{labels[r.feature] ?? FEATURE_LABELS[r.feature] ?? r.feature}</span>
                      <span className="font-mono text-xs text-muted">{fmtValue(r.value)}</span>
                    </div>
                    {r.impact !== undefined && (
                      <>
                        <div className="mt-2 h-1.5 bg-canvas">
                          <div className="h-1.5" style={{ width: `${Math.max(4, (Math.abs(impact) / maxImpact) * 100)}%`, backgroundColor: color }} />
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
                          <Arrow up={raises} />
                          {raises ? "Raised the risk" : "Lowered the risk"}
                          <span className="font-mono font-normal text-muted">
                            ({raises ? "+" : ""}
                            {impact.toFixed(3)})
                          </span>
                        </div>
                      </>
                    )}
                    {cfg.notes[r.feature] && <p className="mt-1 text-xs leading-relaxed text-muted">{cfg.notes[r.feature]}</p>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              The numbers in brackets are the model&apos;s internal units (log-odds). {cfg.explainNote}
            </p>
          </>
        )}
      </div>

      <div className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted" style={{ borderLeft: `3px solid ${cfg.accent}` }}>
        <span className="font-semibold text-ink">About this detector. </span>
        {cfg.caveat}
      </div>
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </section>
  );
}
