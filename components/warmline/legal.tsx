/** Page title and intro for the legal pages. */
export function LegalHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h1 className="text-[32px] leading-tight font-bold tracking-tight sm:text-[40px]">{title}</h1>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/** One numbered section of a legal page. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t py-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}
