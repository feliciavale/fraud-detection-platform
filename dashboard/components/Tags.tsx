import type { Outcome } from "@/lib/api";

// Small labels used in tables and panels. Colour is never the only signal: the word is always there.

export function DecisionTag({ decision }: { decision: "review" | "approve" }) {
  const review = decision === "review";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${
        review ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-300 bg-green-50 text-green-900"
      }`}
    >
      <span className={`h-1.5 w-1.5 ${review ? "bg-amber-600" : "bg-green-700"}`} aria-hidden="true" />
      {review ? "Review" : "Approve"}
    </span>
  );
}

export function OutcomeTag({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return <span className="text-xs text-muted">Not checked yet</span>;
  return (
    <span className="text-xs font-medium">{outcome === "fraud" ? "Confirmed fraud" : "Not fraud"}</span>
  );
}
