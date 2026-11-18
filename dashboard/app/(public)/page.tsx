import Link from "next/link";
import ResultPanel from "@/components/ResultPanel";
import type { ScoreResult } from "@/lib/api";
import { DETECTORS, DetectorId } from "@/lib/detectors";

// The exact response the API returns for the built-in mobile money example
// (TRANSFER of 696,575.46 that empties the sender's account into an empty account).
const EXAMPLE: ScoreResult = {
  risk_score: 0.9999,
  decision: "review",
  top_reasons: [
    { feature: "drainRatio", value: 0.9999985644074162, impact: 5.318, direction: "raises risk" },
    { feature: "oldbalanceOrg", value: 696575.46, impact: 2.219, direction: "raises risk" },
    { feature: "oldbalanceDest", value: 0, impact: 1.045, direction: "raises risk" },
  ],
};
const EXAMPLE_LABELS = { oldbalanceOrg: "Sender balance before", oldbalanceDest: "Receiver balance before" };

const STEPS = [
  {
    title: "Enter the transaction",
    text: "Choose the kind of payment and fill in what is known before it is approved: the amount, balances, or card and email details.",
  },
  {
    title: "Get a decision and the reasons",
    text: "The model returns a risk score, a decision (Approve or Review) and the three details that pushed the score up or down the most.",
  },
  {
    title: "Record what really happened",
    text: "Each check is saved to your history. Mark cases as fraud or not fraud, and Analytics shows how often the flags were right.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Intro and a real example result */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-14 md:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:py-20">
          <div className="lg:pt-10">
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Check a payment for fraud risk, and see why it was flagged.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Sentinel scores phone wallet transfers and online card payments with machine learning models trained on public
              fraud datasets. Every result shows the details that moved the score, and your checks are saved to a private
              history.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-soft">
                Create a free account
              </Link>
              <Link href="/login" className="rounded-md border border-line bg-white px-5 py-2.5 text-sm font-medium hover:bg-canvas">
                Log in
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">A portfolio project. Do not use it for real payments.</p>
          </div>

          <figure>
            <ResultPanel detector="mobile_money" data={EXAMPLE} labels={EXAMPLE_LABELS} />
            <figcaption className="mt-2 text-xs text-muted">
              A real result: the built-in example of a transfer that empties the sender&apos;s account.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-md border border-line bg-white p-5">
              <div className="font-mono text-xs text-muted">Step {i + 1}</div>
              <h3 className="mt-2 text-sm font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The two detectors, with their honest test results */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Two detectors, tested on data they had not seen</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Each detector was trained on older transactions and tested on later ones, the way it would be used in practice.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(Object.keys(DETECTORS) as DetectorId[]).map((id) => {
              const d = DETECTORS[id];
              return (
                <article key={id} className="rounded-md border border-line p-5" style={{ borderTop: `3px solid ${d.accent}` }}>
                  <h3 className="text-base font-semibold">{d.plainName}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{d.summary}</p>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Test result</div>
                  <p className="mt-1 text-sm font-medium">{d.verdict.rating}</p>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                    {d.plain.slice(0, 2).map((p) => (
                      <li key={p.label}>{p.sentence}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* What it is and is not */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-xl font-semibold tracking-tight">Before you use it</h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>A score ranks how unusual a payment looks. It is not proof of fraud and not a percentage chance.</li>
          <li>The phone wallet detector was trained on simulated data, so its near-perfect test results will not carry over to real payments.</li>
          <li>The card payment detector works with real data and is much weaker: most payments it flags are normal.</li>
          <li>Use example values only. Do not enter real card numbers, account numbers or personal details.</li>
        </ul>
      </section>
    </>
  );
}
