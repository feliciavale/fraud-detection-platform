// Every call goes to /api/..., which next.config.ts forwards to FastAPI.
const BASE = "/api";

export type Field = { name: string; kind: "select" | "number"; label?: string; required?: boolean; options?: string[] };
export type Schema = { fraud_type: string; fields: Field[] };
export type Reason = {
  feature: string;
  value?: string | number | null;
  impact?: number;
  direction?: string;
  note?: string;
};
export type ScoreResult = { risk_score: number; decision: "approve" | "review"; top_reasons: Reason[] };
export type Outcome = "fraud" | "not_fraud";
export type Analysis = ScoreResult & {
  id: number;
  fraud_type: string;
  input: Record<string, string | number>;
  created_at: string;
  outcome: Outcome | null;
  outcome_at: string | null;
};
export type User = { id: number; email: string };
export type Stats = {
  fraud_type: string | null;
  total: number;
  last_7_days: number;
  review: number;
  approve: number;
  awaiting_outcome: number;
  outcomes: { flagged_fraud: number; flagged_not_fraud: number; approved_fraud: number; approved_not_fraud: number };
  by_detector: { fraud_type: string; total: number; review: number; approve: number }[];
  daily: { date: string; review: number; approve: number }[];
  histogram: { from: number; to: number; review: number; approve: number }[] | null;
};

/** Thrown for every failed call. status 0 means the API could not be reached. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const UNREACHABLE = "Cannot reach the API. Is uvicorn running on port 8000?";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, { ...init, credentials: "same-origin" });
  } catch {
    throw new ApiError(UNREACHABLE, 0);
  }
  const isJson = (r.headers.get("content-type") ?? "").includes("application/json");
  if (!r.ok) {
    // When FastAPI is down, the Next.js proxy answers with a non-JSON 5xx page.
    if (r.status >= 500 && !isJson) throw new ApiError(UNREACHABLE, 0);
    let message = `Request failed (${r.status}).`;
    if (isJson) {
      const d = await r.json().catch(() => null);
      if (typeof d?.detail === "string") message = d.detail;
      else if (Array.isArray(d?.detail)) message = "Some of the values are not valid.";
    }
    throw new ApiError(message, r.status);
  }
  return r.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Detectors
export const getTypes = () => request<string[]>("/types");
export const getSchema = (type: string) => request<Schema>(`/schema/${type}`);

// Accounts
export const getMe = () => request<User>("/auth/me");
export const login = (email: string, password: string) => request<User>("/auth/login", json("POST", { email, password }));
export const signup = (email: string, password: string) => request<User>("/auth/signup", json("POST", { email, password }));
export const logout = () => request<{ ok: boolean }>("/auth/logout", { method: "POST" });

// Saved analyses
export const createAnalysis = (type: string, payload: Record<string, string | number>) =>
  request<Analysis>(`/analyses/${type}`, json("POST", payload));

export function listAnalyses(params: { fraud_type?: string; decision?: string; outcome?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  return request<{ total: number; items: Analysis[] }>(`/analyses?${q}`);
}

export const setOutcome = (id: number, outcome: Outcome | null) => request<Analysis>(`/analyses/${id}`, json("PATCH", { outcome }));
export const deleteAnalysis = (id: number) => request<{ ok: boolean }>(`/analyses/${id}`, { method: "DELETE" });

export function getStats(fraudType: string | null, days = 30) {
  const q = new URLSearchParams({ days: String(days), tz_offset_minutes: String(-new Date().getTimezoneOffset()) });
  if (fraudType) q.set("fraud_type", fraudType);
  return request<Stats>(`/stats?${q}`);
}
