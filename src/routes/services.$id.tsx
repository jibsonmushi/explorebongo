import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Users, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tripCart } from "@/lib/trip-cart";

export const Route = createFileRoute("/services/$id")({
  head: () => ({
    meta: [
      { title: "Service details — ExploreBongo" },
      { name: "description", content: "See details, price and availability for this Tanzanian tourism service and add it to your trip." },
      { property: "og:title", content: "Service details — ExploreBongo" },
      { property: "og:description", content: "Book this local Tanzanian experience on ExploreBongo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicePage,
});

function ServicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [qty, setQty] = useState(1);
  const q = useQuery({
    queryKey: ["service", id],
    queryFn: async () => (await supabase.from("services").select("*, provider_profiles(business_name,city,region,provider_type), destinations(name), categories(name)").eq("id", id).maybeSingle()).data,
  });
  const reviews = useQuery({
    queryKey: ["service-reviews", id],
    queryFn: async () => (await supabase.from("reviews").select("rating,comment,created_at").eq("service_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const s = q.data;
  if (q.isLoading) return <PublicLayout><p className="p-10">Loading…</p></PublicLayout>;
  if (!s) return <PublicLayout><div className="p-10 text-center"><h1 className="text-2xl font-semibold">Service not found</h1><Link to="/discover" className="mt-4 inline-block text-primary underline">Back to Discover</Link></div></PublicLayout>;
  const avg = reviews.data?.length ? (reviews.data.reduce((a, r) => a + r.rating, 0) / reviews.data.length).toFixed(1) : null;

  const add = () => {
    if (!date) { toast.error("Pick a date"); return; }
    tripCart.add({ service_id: s.id, title: s.title, provider: s.provider_profiles?.business_name ?? "", price: Number(s.price), currency: s.currency, date, quantity: qty });
    toast.success("Added to your trip");
    navigate({ to: "/trip" });
  };

  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1fr_340px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-earth">{s.categories?.name ?? s.provider_profiles?.provider_type}{s.destinations?.name ? ` · ${s.destinations.name}` : ""}</p>
          <h1 className="mt-2 text-4xl font-semibold">{s.title}</h1>
          <p className="mt-2 text-muted-foreground">by {s.provider_profiles?.business_name} — {[s.provider_profiles?.city, s.provider_profiles?.region].filter(Boolean).join(", ")}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {s.duration_minutes && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{Math.round(s.duration_minutes / 60 * 10) / 10} h</span>}
            {s.capacity && <span className="flex items-center gap-1"><Users className="h-4 w-4" />Up to {s.capacity}</span>}
            {avg && <span className="flex items-center gap-1"><Star className="h-4 w-4 text-gold" />{avg} ({reviews.data?.length})</span>}
          </div>
          <p className="mt-6 whitespace-pre-line leading-relaxed">{s.description}</p>
          <h2 className="mt-10 text-xl font-semibold">Reviews</h2>
          {reviews.data?.length ? reviews.data.map((r, i) => (
            <div key={i} className="mt-3 rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{"★".repeat(r.rating)}</p><p className="text-sm">{r.comment}</p></div>
          )) : <p className="mt-2 text-sm text-muted-foreground">No reviews yet.</p>}
        </div>
        <aside className="h-fit space-y-4 rounded-2xl border bg-card p-6 shadow-card">
          <p className="font-display text-3xl font-semibold text-primary">{s.currency} {Number(s.price).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">per person / unit</p>
          <div className="space-y-1.5"><Label htmlFor="d">Date</Label><Input id="d" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="q">Guests / units</Label><Input id="q" type="number" min={1} max={s.capacity ?? 50} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} /></div>
          <Button className="w-full" size="lg" variant="gold" onClick={add}>Add to my trip</Button>
        </aside>
      </section>
    </PublicLayout>
  );
}
