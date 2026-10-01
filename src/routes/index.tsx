import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Compass, ShieldCheck, Users, Store, CalendarCheck, Wallet, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import hero from "@/assets/hero.jpg";
import arusha from "@/assets/arusha.jpg";
import safari from "@/assets/safari.jpg";
import culture from "@/assets/culture.jpg";
import zanzibar from "@/assets/zanzibar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExploreBongo — Discover Tanzania. Your way." },
      { name: "description", content: "Explore destinations, discover local experiences, and connect with trusted tourism providers across Tanzania." },
      { property: "og:title", content: "ExploreBongo — Discover Tanzania. Your way." },
      { property: "og:description", content: "One platform connecting travelers with trusted Tanzanian tourism providers." },
    ],
  }),
  component: Index,
});

const experiences = [
  { img: safari, title: "Wildlife Safaris", place: "Serengeti & Ngorongoro" },
  { img: culture, title: "Cultural Encounters", place: "Arusha region" },
  { img: zanzibar, title: "Island & Beach", place: "Zanzibar" },
];

const steps = [
  { icon: Compass, title: "Discover", text: "Browse experiences, guides, transport and stays from local providers." },
  { icon: CalendarCheck, title: "Request", text: "Send booking requests directly to the providers you choose." },
  { icon: Sparkles, title: "Experience", text: "Travel Tanzania with people who know it best." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <section className="relative min-h-[92vh] overflow-hidden">
        <img src={hero} alt="Mount Kilimanjaro at sunrise over the savanna" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <SiteHeader overlay />
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-5 pb-20 pt-32">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Discover • Explore • Experience Tanzania</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] text-on-image md:text-7xl">
            Discover Tanzania.<br /><em className="font-normal text-gold">Your way.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-on-image/85">
            Explore destinations, discover local experiences, and connect with trusted tourism providers through one platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="xl"><Link to="/discover">Explore Tanzania <ArrowRight /></Link></Button>
            <Button asChild variant="glass" size="xl"><Link to="/become-provider">Become a Provider</Link></Button>
          </div>
        </div>
      </section>
      <div className="kente" />

      <section className="mx-auto max-w-7xl px-5 py-20">
        <SectionHead eyebrow="Popular Experiences" title="Where will Tanzania take you?" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {experiences.map((e) => (
            <Link to="/discover" key={e.title} className="group relative aspect-[4/5] overflow-hidden rounded-2xl shadow-card">
              <img src={e.img} alt={e.title} loading="lazy" width={1024} height={1280} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-hero-overlay" />
              <div className="absolute bottom-0 p-6">
                <p className="flex items-center gap-1 text-xs text-gold"><MapPin className="h-3 w-3" />{e.place}</p>
                <h3 className="mt-1 text-2xl font-semibold text-on-image">{e.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 md:grid-cols-2">
          <img src={arusha} alt="Arusha with Mount Meru" loading="lazy" width={1280} height={960} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />
          <div>
            <SectionHead eyebrow="Explore Arusha" title="The gateway to the northern circuit" align="left" />
            <p className="mt-5 text-muted-foreground">
              Under the shadow of Mount Meru, Arusha is where most safaris begin — coffee farms, cultural villages, markets and the road to Serengeti, Ngorongoro and Tarangire.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">ExploreBongo is launching first in Arusha, with more regions to follow.</p>
            <Button asChild className="mt-6" size="lg"><Link to="/discover">See what's in Arusha</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <SectionHead eyebrow="How ExploreBongo Works" title="Tourist → ExploreBongo → Provider" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border bg-card p-7 shadow-card">
              <div className="flex items-center justify-between">
                <s.icon className="h-8 w-8 text-primary" />
                <span className="font-display text-4xl text-gold">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-night text-night-foreground">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-20 md:grid-cols-2">
          <Audience
            eyebrow="For Travelers" title="Plan a trip made of real, local experiences"
            points={["Browse providers across Tanzania", "Save favorites & build itineraries", "AI Trip Planner (coming soon)"]}
            cta={<Button asChild variant="gold" size="lg"><Link to="/auth" search={{ mode: "signup" }}>Create a traveler account</Link></Button>}
          />
          <Audience
            eyebrow="For Tourism Providers" title="List your services and reach travelers directly"
            points={["Create your business profile", "Upload services, set prices & capacity", "Receive booking requests"]}
            cta={<Button asChild variant="glass" size="lg"><Link to="/become-provider">Become a Provider</Link></Button>}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <SectionHead eyebrow="Why ExploreBongo" title="Built in Tanzania, for Tanzania" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, t: "Verified providers", d: "Every provider goes through a verification review." },
            { icon: Users, t: "Local first", d: "Book directly with guides, hosts and operators." },
            { icon: Store, t: "Many providers, one trip", d: "Combine services from different providers." },
            { icon: Wallet, t: "Fair for everyone", d: "Transparent pricing set by providers." },
          ].map((f) => (
            <div key={f.t}>
              <f.icon className="h-7 w-7 text-earth" />
              <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl">
          <img src={safari} alt="" loading="lazy" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-night/75" />
          <div className="relative px-6 py-16 text-center md:py-24">
            <h2 className="text-4xl font-semibold text-on-image md:text-5xl">Karibu Tanzania.</h2>
            <p className="mx-auto mt-3 max-w-lg text-on-image/80">Start exploring today, or bring your tourism business online.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="gold" size="xl"><Link to="/discover">Explore Tanzania</Link></Button>
              <Button asChild variant="glass" size="xl"><Link to="/provider/register">Register as Provider</Link></Button>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function SectionHead({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-earth">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold md:text-5xl">{title}</h2>
    </div>
  );
}

function Audience({ eyebrow, title, points, cta }: { eyebrow: string; title: string; points: string[]; cta: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-sidebar-border bg-sidebar-accent/40 p-8 md:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">{eyebrow}</p>
      <h3 className="mt-3 text-3xl font-semibold">{title}</h3>
      <ul className="mt-6 space-y-2 text-sm opacity-85">
        {points.map((p) => <li key={p} className="flex gap-2"><span className="text-gold">◆</span>{p}</li>)}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}
