"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/api";
import type { DetectorId } from "@/lib/detectors";

/** "all" or one detector. Shared by Overview, History and Analytics through the switcher in the sidebar. */
export type Scope = "all" | DetectorId;

export type ConsoleContext = {
  user: User;
  scope: Scope;
  setScope: (s: Scope) => void;
};

export const Console = createContext<ConsoleContext | null>(null);

export function useConsole(): ConsoleContext {
  const ctx = useContext(Console);
  if (!ctx) throw new Error("useConsole must be used inside the console layout.");
  return ctx;
}

/** If the session ended (401), send the user to log in and come back. Returns true when it handled the error. */
export function redirectIfLoggedOut(e: unknown): boolean {
  if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return true;
  }
  return false;
}
