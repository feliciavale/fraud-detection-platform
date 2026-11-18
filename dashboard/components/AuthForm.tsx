"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, login, signup } from "@/lib/api";

const inputClass =
  "mt-1.5 block h-10 w-full rounded-md border border-line bg-white px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15";

/** Where to go after logging in. Only paths inside this site are allowed, so a link cannot send people elsewhere. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  // Already logged in: skip the form.
  useEffect(() => {
    getMe()
      .then(() => router.replace(nextPath()))
      .catch(() => undefined);
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (isSignup ? signup(email, password) : login(email, password));
      router.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? "Create an account" : "Log in"}</h1>
      <p className="mt-2 text-sm text-muted">
        {isSignup
          ? "Your account keeps a private history of the transactions you check. Use any email; it is only used to log in."
          : "Log in to check transactions and see your history."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-md border border-line bg-white p-6">
        <label className="block text-sm font-medium">
          Email
          <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            className={inputClass}
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && <span className="mt-1 block text-xs font-normal text-muted">At least 8 characters.</span>}
        </label>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="h-10 w-full rounded-md bg-ink text-sm font-medium text-white hover:bg-ink-soft disabled:opacity-50">
          {busy ? "Please wait" : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-ink underline underline-offset-2">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
      {isSignup && (
        <p className="mt-6 text-xs leading-relaxed text-muted">
          By creating an account you agree to the <Link href="/terms" className="underline">terms</Link> and confirm you have read
          the <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
      )}
    </div>
  );
}
