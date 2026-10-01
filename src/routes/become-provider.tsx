import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, Mountain, User, UtensilsCrossed, BedDouble, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/site/PublicLayout";
import culture from "@/assets/culture.jpg";

export const Route = createFileRoute("/become-provider")({
  head: () => ({
    meta: [
      { title: "Become a Provider — ExploreBongo" },
      { name: "description", content: "List your tourism services on ExploreBongo and connect with travelers." },
      { property: "og:title", content: "Become a Provider — ExploreBongo" },
      { property: "og:description", content: "List your tourism services on ExploreBongo and connect with travelers." },
    ],
  }),
  component: BecomeProvider,
});

const types = [
  { icon: Bus, l: "Transport" }, { icon: Mountain, l: "Activities" }, { icon: User, l: "Guides" },
  { icon: UtensilsCrossed, l: "Restaurants & Food" }, { icon: BedDouble, l: "Accommodation" }, { icon: Sparkles, l: "Experience Hosts" },
];

function BecomeProvider() {
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-earth">For Tourism Providers</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-6xl">List your tourism services on ExploreBongo and connect with travelers.</h1>
          <ul className="mt-6 space-y-2 text-muted-foreground">
            {["Free business profile", "Set your own prices, availability and capacity", "Receive booking requests from travelers"].map((t) => (
              <li key={t} className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />{t}</li>
            ))}
          </ul>
          <Button asChild variant="gold" size="xl" className="mt-8"><Link to="/provider/register">Register your business</Link></Button>
        </div>
        <img src={culture} alt="Local hosts in the Arusha region" width={1024} height={1280} className="aspect-[4/5] w-full rounded-3xl object-cover shadow-card" />
      </section>
      <section className="bg-secondary/60">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <h2 className="text-center text-3xl font-semibold">Who can join</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-6">
            {types.map((t) => (
              <div key={t.l} className="rounded-2xl border bg-card p-5 text-center">
                <t.icon className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 text-sm font-medium">{t.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[["1", "Create your account"], ["2", "Add business details"], ["3", "Get verified"]].map(([n, t]) => (
              <div key={n} className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-display text-xl text-primary-foreground">{n}</span>
                <p className="font-semibold">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
