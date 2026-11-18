import PageHeader from "@/components/PageHeader";

export type LegalSection = { heading: string; body: React.ReactNode };

// Shared layout for the Privacy and Terms pages. Content lives in each page file.
export default function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader title={title}>Last updated {updated}</PageHeader>
      <div className="space-y-6 rounded-md border border-line bg-white px-6 py-6 text-sm leading-relaxed">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-sm font-semibold">{s.heading}</h2>
            <div className="mt-1.5 space-y-2 text-[#2f3a4a]">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
