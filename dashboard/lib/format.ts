import type { Analysis, Reason } from "@/lib/api";

/** A value as people read it. Empty values say so instead of showing a blank. */
export function fmtValue(v: Reason["value"]): string {
  if (v === null || v === undefined || v === "") return "not provided";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(4).replace(/\.?0+$/, "");
  return v;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(isoDate: string): string {
  // isoDate is "YYYY-MM-DD" in the user's own calendar, so read it as a local date.
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");

/** The amount field differs per detector. */
export function amountOf(a: Analysis): number | null {
  const v = a.input.amount ?? a.input.TransactionAmt;
  return typeof v === "number" ? v : v !== undefined ? Number(v) : null;
}

export const fmtAmount = (n: number | null) =>
  n === null || Number.isNaN(n) ? "not provided" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
