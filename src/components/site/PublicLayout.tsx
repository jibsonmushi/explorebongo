import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="border-b bg-secondary/60">
      <div className="mx-auto max-w-5xl px-5 py-16 text-center md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-earth">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold md:text-5xl">{title}</h1>
        {children && <div className="mx-auto mt-4 max-w-2xl text-muted-foreground">{children}</div>}
      </div>
    </section>
  );
}
