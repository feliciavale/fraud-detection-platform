"use client";

import { DETECTORS } from "@/lib/detectors";
import { useConsole } from "@/lib/session";

/** One sentence saying which detector the page is showing, set by the switcher in the sidebar. */
export default function ScopeNote() {
  const { scope } = useConsole();
  return (
    <span>
      Showing <b className="font-medium text-ink">{scope === "all" ? "all detectors" : DETECTORS[scope].name}</b>. Change this
      with <i>Show data for</i> in the menu.
    </span>
  );
}
