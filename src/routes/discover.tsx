import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageIntro } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover Tanzania — ExploreBongo" },
      { name: "description", content: "Browse destinations and tourism services from verified Tanzanian providers." },
      { property: "og:title", content: "Discover Tanzania — ExploreBongo" },
      { property: "og:description", content: "Destinations and services from verified local providers." },
    ],
  }),
  component: Discover,
});

function Discover() {
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: async () => (await supabase.from("destinations").select("id,name,region").order("name")).data ?? [],
  });
  const services = useQuery({
    queryKey: ["public-services"],
    queryFn: async () =>
      (await supabase.from("services").select("id,title,price,currency,description,provider_profiles(business_name)").eq("is_published", true).limit(24)).data ?? [],
  });

  return (
    <PublicLayout>
      <PageIntro eyebrow="Discover" title="Explore Tanzania">Destinations and services listed by verified local providers.</PageIntro>
      <section className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-2xl font-semibold">Destinations</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {destinations.data?.map((d) => (
            <span key={d.id} className="flex items-center gap-1 rounded-full border bg-card px-4 py-2 text-sm">
              <MapPin className="h-3.5 w-3.5 text-earth" />{d.name}<span className="text-muted-foreground">· {d.region}</span>
            </span>
          ))}
        </div>
        <h2 className="mt-14 text-2xl font-semibold">Services</h2>
        {services.data && services.data.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.data.map((s) => (
              <Link key={s.id} to="/services/$id" params={{ id: s.id }} className="rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5">
                <p className="text-xs text-muted-foreground">{s.provider_profiles?.business_name}</p>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                <p className="mt-4 font-semibold text-primary">{s.currency} {Number(s.price).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">
            {services.isLoading ? "Loading…" : "No services are listed yet. Verified providers will appear here soon."}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
