export default function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
    </header>
  );
}
