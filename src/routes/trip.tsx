import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageIntro } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tripCart, useTripCart } from "@/lib/trip-cart";

export const Route = createFileRoute("/trip")({
  head: () => ({
    meta: [
      { title: "My Trip Builder — ExploreBongo" },
      { name: "description", content: "Combine services from multiple Tanzanian providers into one trip and send a single booking request." },
      { property: "og:title", content: "Trip Builder — ExploreBongo" },
      { property: "og:description", content: "Build one trip from many local providers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripPage,
});

function TripPage() {
  const items = useTripCart();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  const currency = items[0]?.currency ?? "USD";
  const total = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const sorted = items.map((it, idx) => ({ it, idx })).sort((a, b) => a.it.date.localeCompare(b.it.date));

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { data: b, error } = await supabase.from("bookings").insert({ tourist_id: user.id, currency, notes: notes.slice(0, 1000) || null, status: "draft" }).select("id").single();
    if (error || !b) { setBusy(false); toast.error(error?.message ?? "Could not create booking"); return; }
    const { error: e2 } = await supabase.from("booking_items").insert(items.map((i) => ({ booking_id: b.id, service_id: i.service_id, date: i.date, quantity: i.quantity, unit_price: 0, provider_id: "00000000-0000-0000-0000-000000000000" })));
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    tripCart.clear();
    toast.success("Booking request sent to providers!");
    navigate({ to: "/dashboard", search: { section: "trips" } });
  };

  return (
    <PublicLayout>
      <PageIntro eyebrow="Trip Builder" title="Your trip">One request — every provider confirms their own part.</PageIntro>
      <section className="mx-auto max-w-4xl px-5 py-12">
        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">
            Your trip is empty. <Link to="/discover" className="font-semibold text-primary underline">Discover services</Link> or try the <Link to="/trip-planner" className="font-semibold text-primary underline">AI Trip Planner</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map(({ it, idx }) => (
              <div key={idx} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{it.title}</p>
                  <p className="text-xs text-muted-foreground">{it.provider}</p>
                </div>
                <Input type="date" className="w-40" value={it.date} onChange={(e) => tripCart.update(idx, { date: e.target.value })} />
                <Input type="number" min={1} className="w-20" value={it.quantity} onChange={(e) => tripCart.update(idx, { quantity: Math.max(1, Number(e.target.value)) })} />
                <p className="w-28 text-right font-semibold">{it.currency} {(it.price * it.quantity).toLocaleString()}</p>
                <button aria-label="Remove" onClick={() => tripCart.remove(idx)}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            ))}
            <Textarea placeholder="Notes for providers (pickup location, dietary needs…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-accent p-5">
              <p className="text-lg">Estimated total: <span className="font-display text-2xl font-semibold">{currency} {total.toLocaleString()}</span></p>
              {user ? (
                <Button size="lg" variant="gold" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send booking request"}</Button>
              ) : (
                <Button asChild size="lg"><Link to="/auth">Log in to book</Link></Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Prices are confirmed by each provider. Payment is collected after providers accept.</p>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
