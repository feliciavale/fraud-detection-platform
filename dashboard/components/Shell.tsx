"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { ApiError, User, getMe, logout } from "@/lib/api";
import { DETECTORS, DetectorId } from "@/lib/detectors";
import { Console, Scope } from "@/lib/session";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/analyze", label: "Analyze transaction" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/performance", label: "Model performance" },
];
const REPO = "https://github.com/feliciavale/fraud-detection-platform";
const SCOPE_KEY = "sentinel.scope";

/**
 * Layout for every page after login.
 * 1. Asks the API who is logged in. If nobody, sends the visitor to /login and back here afterwards.
 *    (This only decides what to show. The API itself refuses data to anyone not logged in.)
 * 2. Holds the detector switcher (All, Mobile money, E-commerce) used by Overview, History and Analytics.
 */
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<Scope>("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCOPE_KEY);
      if (saved === "all" || saved === "mobile_money" || saved === "ecommerce") setScopeState(saved);
    } catch {
      /* storage unavailable: keep "all" */
    }
  }, []);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((e: ApiError) => {
        if (e.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
        else setError(e.message);
      });
    // Only on first load; later 401s are handled by the page that receives them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setScope(s: Scope) {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* ignore */
    }
  }

  async function signOut() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div role="alert" className="max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }
  if (!user) return <div className="min-h-screen bg-canvas" aria-busy="true" />;

  const scopes: { id: Scope; label: string }[] = [
    { id: "all", label: "All" },
    ...(Object.keys(DETECTORS) as DetectorId[]).map((id) => ({ id, label: DETECTORS[id].name })),
  ];

  return (
    <Console.Provider value={{ user, scope, setScope }}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex flex-col bg-ink text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
          <Link href="/overview" className="flex items-center gap-3 px-5 py-4 md:py-6">
            <Logo />
            <span>
              <span className="block text-[15px] font-semibold leading-tight">Sentinel</span>
              <span className="block text-xs text-slate-400">Fraud scoring console</span>
            </span>
          </Link>

          <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
            {NAV.map((n) => {
              const active = path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-md border-l-2 px-3 py-2 text-sm ${
                    active ? "border-white bg-white/10 font-medium text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Detector switcher */}
          <div className="px-5 pb-4 md:mt-8 md:pb-0">
            <div id="scope-label" className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Show data for
            </div>
            <div role="radiogroup" aria-labelledby="scope-label" className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-white/15 md:grid-cols-1">
              {scopes.map((s) => {
                const active = scope === s.id;
                const accent = s.id === "all" ? null : DETECTORS[s.id].accent;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setScope(s.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-left text-xs ${active ? "bg-white font-medium text-ink" : "bg-ink text-slate-300 hover:text-white"}`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: accent ?? (active ? "#14243A" : "#94A3B8") }} aria-hidden="true" />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 hidden text-[11px] leading-relaxed text-slate-400 md:block">Applies to Overview, History and Analytics.</p>
          </div>

          <div className="mt-auto hidden border-t border-white/10 px-5 py-4 text-xs text-slate-400 md:block">
            <div className="truncate text-slate-200" title={user.email}>{user.email}</div>
            <button type="button" onClick={signOut} className="mt-1 underline underline-offset-2 hover:text-white">
              Log out
            </button>
            <div className="mt-4 flex gap-4">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <a href={REPO} className="hover:text-white">Source</a>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
          <footer className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-4 text-xs text-muted md:hidden">
            <span className="truncate">{user.email}</span>
            <button type="button" onClick={signOut} className="underline">Log out</button>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </footer>
        </div>
      </div>
    </Console.Provider>
  );
}
