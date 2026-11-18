import Link from "next/link";
import Logo from "@/components/Logo";

const REPO = "https://github.com/feliciavale/fraud-detection-platform";

/** Header and footer for pages anyone can open: landing, login, sign up, privacy, terms. */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo dark={false} />
            <span className="text-[15px] font-semibold">Sentinel</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-1.5 font-medium hover:bg-canvas">
              Log in
            </Link>
            <Link href="/signup" className="rounded-md bg-ink px-3 py-1.5 font-medium text-white hover:bg-ink-soft">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted md:px-6">
          <span>Sentinel is a portfolio project by Felicia. It is not for real payment decisions.</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <a href={REPO} className="hover:text-ink">Source code</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
