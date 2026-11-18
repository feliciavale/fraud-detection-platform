"use client";

import { useState } from "react";

// Colours for the two decisions. Checked with the colour validator: they pass for normal vision and are
// told apart for colour-blind readers by the legend, the gap between stacked parts and the hover label.
export const REVIEW_COLOR = "#D97706";
export const APPROVE_COLOR = "#15803D";

/** Rounds the top of the axis up to 1, 2 or 5 times a power of ten, and returns evenly spaced ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const stepInt = Math.max(1, Math.round(step));
  const ticks: number[] = [];
  for (let t = 0; t <= max + stepInt - 1; t += stepInt) ticks.push(t);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + stepInt);
  return ticks;
}

export type Bar = { label: string; review: number; approve: number; marker?: boolean };

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Columns with up to two stacked parts (Review on top of Approve).
 * `single` draws one colour (the total), used when the split is already shown by position, like the score spread.
 * `labelEvery` shows every n-th x-axis label so they do not collide.
 * `thresholdAt` draws a vertical line before that column index (the review threshold on the score chart).
 */
export function ColumnChart({
  bars,
  title,
  unit,
  labelEvery = 1,
  single,
  thresholdAt,
  thresholdLabel,
}: {
  bars: Bar[];
  title: string;
  unit: string;
  labelEvery?: number;
  single?: string;
  thresholdAt?: number;
  thresholdLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...bars.map((b) => b.review + b.approve), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const H = 180;

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {single ? <span className="text-xs text-muted">{unit}</span> : <Legend items={[{ color: REVIEW_COLOR, label: "Review" }, { color: APPROVE_COLOR, label: "Approve" }]} />}
        <button type="button" className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-1.5 pr-4 font-medium">{single ? "Score range" : "Day"}</th>
                {!single && <th scope="col" className="py-1.5 pr-4 text-right font-medium">Review</th>}
                {!single && <th scope="col" className="py-1.5 pr-4 text-right font-medium">Approve</th>}
                <th scope="col" className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.label} className="border-b border-line last:border-b-0">
                  <td className="py-1.5 pr-4">{b.label}</td>
                  {!single && <td className="py-1.5 pr-4 text-right font-mono tabular-nums">{b.review}</td>}
                  {!single && <td className="py-1.5 pr-4 text-right font-mono tabular-nums">{b.approve}</td>}
                  <td className="py-1.5 text-right font-mono tabular-nums">{b.review + b.approve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" role="img" aria-label={`${title}. Use "Show as table" for the exact numbers.`}>
          {/* y-axis labels */}
          <div className="relative w-8 shrink-0 font-mono text-[10px] text-muted" style={{ height: H }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / top) * H }}>
                {t}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* gridlines */}
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: H - (t / top) * H }} aria-hidden="true" />
            ))}

            {/* columns */}
            <div className="relative flex items-end" style={{ height: H }}>
              {bars.map((b, i) => {
                const total = b.review + b.approve;
                return (
                  <div
                    key={b.label}
                    className="relative flex h-full flex-1 items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {thresholdAt === i && (
                      <div className="absolute -left-px bottom-0 top-0 w-0.5 bg-amber-500" aria-hidden="true">
                        {thresholdLabel && (
                          <span className="absolute -top-5 left-1 whitespace-nowrap font-mono text-[10px] text-muted">{thresholdLabel}</span>
                        )}
                      </div>
                    )}
                    <div className="flex w-full max-w-6 flex-col justify-end gap-0.5 px-px" style={{ height: `${(total / top) * 100}%` }}>
                      {single ? (
                        total > 0 && <div className="flex-1 rounded-t" style={{ backgroundColor: single }} />
                      ) : (
                        <>
                          {b.review > 0 && <div className="rounded-t" style={{ backgroundColor: REVIEW_COLOR, flexGrow: b.review }} />}
                          {b.approve > 0 && (
                            <div className={b.review > 0 ? "" : "rounded-t"} style={{ backgroundColor: APPROVE_COLOR, flexGrow: b.approve }} />
                          )}
                        </>
                      )}
                    </div>
                    {hover === i && (
                      <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-sm">
                        <div className="font-medium">{b.label}</div>
                        {single ? (
                          <div className="font-mono">{total} {total === 1 ? "check" : "checks"}</div>
                        ) : (
                          <>
                            <div className="font-mono">Review {b.review}</div>
                            <div className="font-mono">Approve {b.approve}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* x-axis labels */}
            <div className="mt-1.5 flex font-mono text-[10px] text-muted" aria-hidden="true">
              {bars.map((b, i) => (
                <div key={b.label} className="relative h-3.5 flex-1">
                  {(i % labelEvery === 0 || i === bars.length - 1) && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{b.label}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
