import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";
import { generatePlan, type Plan } from "@/lib/planner.functions";

export function MyTrips({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["my-trips", userId],
    queryFn: async () => (await supabase.from("bookings").select("id,status,total_amount,currency,notes,created_at,booking_items(id,date,quantity,unit_price,status,services(title,currency))").eq("tourist_id", userId).order("created_at", { ascending: false })).data ?? [],
  });
  const cancel = async (bookingId: string, itemId?: string) => {
    if (!confirm(itemId ? "Cancel this part of your trip?" : "Cancel the whole trip?")) return;
    const { error } = await supabase.rpc("cancel_booking", itemId ? { _booking_id: bookingId, _item_id: itemId } : { _booking_id: bookingId });
    if (error) { toast.error(error.message); return; }
    toast.success("Cancelled"); q.refetch();
  };
  if (q.isLoading) return <p>Loading…</p>;
  if (!q.data?.length) return (
    <div className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">
      No trips yet. <Link to="/discover" className="font-semibold text-primary underline">Find experiences</Link>
    </div>
  );
  return (
    <div className="space-y-4">
      {q.data.map((b) => (
        <div key={b.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Trip requested {new Date(b.created_at).toLocaleDateString()}</p>
              <p className="text-sm text-muted-foreground">Total {b.currency} {Number(b.total_amount).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={b.status} />
              {b.booking_items.some((i) => i.status === "requested" || i.status === "confirmed") && (
                <Button size="sm" variant="outline" onClick={() => cancel(b.id)}>Cancel trip</Button>
              )}
            </div>
          </div>
          {b.status === "requested" && b.booking_items.some((i) => i.status === "confirmed") && (
            <p className="mt-2 text-xs text-muted-foreground">Partially confirmed — waiting on the remaining providers.</p>
          )}
          <ul className="mt-4 divide-y">
            {b.booking_items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium">{i.services?.title}</span> · {i.date ?? "—"} · {i.quantity} guest(s) · {i.services?.currency} {(Number(i.unit_price) * i.quantity).toLocaleString()}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  {(i.status === "requested" || i.status === "confirmed") && (
                    <button className="text-xs text-destructive underline" onClick={() => cancel(b.id, i.id)}>Cancel</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TripPlanner({ userId }: { userId: string }) {
  const gen = useServerFn(generatePlan);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ plan: Plan; services: { id: string; title: string; price: string }[] } | null>(null);
  const saved = useQuery({
    queryKey: ["itineraries", userId],
    queryFn: async () => (await supabase.from("itineraries").select("id,title,created_at").eq("user_id", userId).order("created_at", { ascending: false })).data ?? [],
  });
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      setResult(await gen({ data: { days: Number(f["days"]) || 5, budget: Number(f["budget"]) || 0, travelers: Number(f["travelers"]) || 1, interests: f["interests"] ?? "" } }));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Something went wrong"); }
    setBusy(false);
  };
  const save = async () => {
    if (!result) return;
    const { error } = await supabase.from("itineraries").insert({ user_id: userId, title: result.plan.title.slice(0, 150), content: result as never });
    if (error) { toast.error(error.message); return; }
    toast.success("Itinerary saved"); saved.refetch();
  };
  const byId = new Map(result?.services.map((s) => [s.id, s]) ?? []);
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 self-start">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label htmlFor="days">Days</Label><Input id="days" name="days" type="number" min={1} max={21} defaultValue={5} /></div>
          <div className="space-y-1.5"><Label htmlFor="travelers">People</Label><Input id="travelers" name="travelers" type="number" min={1} max={50} defaultValue={2} /></div>
          <div className="space-y-1.5"><Label htmlFor="budget">Budget $</Label><Input id="budget" name="budget" type="number" min={0} defaultValue={2000} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="interests">Interests</Label><Textarea id="interests" name="interests" rows={4} maxLength={500} placeholder="Safari, beaches in Zanzibar, local food…" /></div>
        <Button variant="gold" className="w-full" disabled={busy}><Sparkles className="h-4 w-4" />{busy ? "Planning…" : "Plan my trip"}</Button>
        {!!saved.data?.length && (
          <div className="border-t pt-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Saved</p>
            <ul className="mt-2 space-y-1 text-sm">{saved.data.map((i) => <li key={i.id}>{i.title}</li>)}</ul></div>
        )}
      </form>
      <div>
        {!result && <div className="grid h-full place-items-center rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">Your itinerary will appear here.</div>}
        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-2xl font-semibold">{result.plan.title}</h2><p className="mt-1 text-sm text-muted-foreground">{result.plan.overview}</p>
                <p className="mt-1 text-sm font-semibold">Estimated ~USD {Math.round(result.plan.estimated_total_usd).toLocaleString()}</p></div>
              <Button variant="outline" onClick={save}>Save itinerary</Button>
            </div>
            {result.plan.days.map((d) => (
              <div key={d.day} className="rounded-2xl border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gold">Day {d.day}</p>
                <h3 className="font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d.summary}</p>
                {d.service_ids.map((id) => byId.get(id) && (
                  <Link key={id} to="/services/$id" params={{ id }} className="mt-2 flex justify-between rounded-lg bg-accent px-3 py-2 text-sm hover:underline">
                    <span>{byId.get(id)!.title}</span><span>{byId.get(id)!.price}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
