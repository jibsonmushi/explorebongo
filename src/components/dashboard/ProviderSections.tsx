import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./StatusBadge";

export function useProviderItems(providerId?: string) {
  return useQuery({
    queryKey: ["provider-items", providerId],
    enabled: !!providerId,
    queryFn: async () =>
      (await supabase.from("booking_items").select("id,date,quantity,unit_price,status,created_at,booking_id,services(title,currency),bookings(notes,tourist_id)").eq("provider_id", providerId!).order("created_at", { ascending: false })).data ?? [],
  });
}

export function useProviderServices(providerId?: string) {
  return useQuery({
    queryKey: ["provider-services", providerId],
    enabled: !!providerId,
    queryFn: async () => (await supabase.from("services").select("*").eq("provider_id", providerId!).order("created_at", { ascending: false })).data ?? [],
  });
}

export function MyServices({ providerId }: { providerId: string }) {
  const q = useProviderServices(providerId);
  if (!q.data?.length) return <p className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">No services yet. Use “Add Service” to create one.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {q.data.map((s) => (
        <div key={s.id} className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{s.title}</h3><StatusBadge status={s.is_published ? "LIVE" : "IN REVIEW"} /></div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
          <p className="mt-3 font-semibold text-primary">{s.currency} {Number(s.price).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function AddService({ providerId, onDone }: { providerId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [] });
  const dests = useQuery({ queryKey: ["destinations"], queryFn: async () => (await supabase.from("destinations").select("id,name,region").order("name")).data ?? [] });
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const price = Number(f["price"]);
    if (!f["title"]?.trim() || !(price > 0)) { toast.error("Title and a valid price are required"); return; }
    setBusy(true);
    const { error } = await supabase.from("services").insert({
      provider_id: providerId, title: f["title"].trim().slice(0, 150), description: (f["description"] ?? "").slice(0, 4000), price,
      currency: f["currency"] || "USD", capacity: f["capacity"] ? Number(f["capacity"]) : null,
      duration_minutes: f["hours"] ? Math.round(Number(f["hours"]) * 60) : null,
      category_id: f["category_id"] || null, destination_id: f["destination_id"] || null, is_published: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service submitted for review");
    onDone();
  };
  const sel = "h-10 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
      <div className="space-y-1.5"><Label htmlFor="title">Title</Label><Input id="title" name="title" maxLength={150} /></div>
      <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={5} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="price">Price</Label><Input id="price" name="price" type="number" min={1} step="0.01" /></div>
        <div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><select id="currency" name="currency" className={sel}><option>USD</option><option>TZS</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="capacity">Capacity</Label><Input id="capacity" name="capacity" type="number" min={1} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="hours">Duration (hours)</Label><Input id="hours" name="hours" type="number" min={0} step="0.5" /></div>
        <div className="space-y-1.5"><Label htmlFor="category_id">Category</Label><select id="category_id" name="category_id" className={sel}><option value="">—</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="destination_id">Destination</Label><select id="destination_id" name="destination_id" className={sel}><option value="">—</option>{dests.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      </div>
      <p className="text-xs text-muted-foreground">New services are reviewed by ExploreBongo before travelers can see them.</p>
      <Button disabled={busy}>{busy ? "Saving…" : "Submit service"}</Button>
    </form>
  );
}

export function BookingRequests({ providerId, pendingOnly }: { providerId: string; pendingOnly: boolean }) {
  const q = useProviderItems(providerId);
  const rows = (q.data ?? []).filter((r) => (pendingOnly ? r.status === "requested" : r.status !== "requested"));
  const set = async (id: string, status: "confirmed" | "cancelled" | "completed") => {
    const { error } = await supabase.from("booking_items").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`); q.refetch();
  };
  if (!rows.length) return <p className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">{pendingOnly ? "No pending requests." : "No bookings yet."}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.services?.title}</p>
            <p className="text-xs text-muted-foreground">{r.date} · {r.quantity} guest(s) · {r.services?.currency} {(Number(r.unit_price) * r.quantity).toLocaleString()}</p>
            {r.bookings?.notes && <p className="mt-1 text-xs italic">“{r.bookings.notes}”</p>}
          </div>
          <StatusBadge status={r.status} />
          {r.status === "requested" && <><Button size="sm" onClick={() => set(r.id, "confirmed")}>Accept</Button><Button size="sm" variant="outline" onClick={() => set(r.id, "cancelled")}>Decline</Button></>}
          {r.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => set(r.id, "completed")}>Mark completed</Button>}
        </div>
      ))}
    </div>
  );
}

export function Earnings({ providerId }: { providerId: string }) {
  const q = useProviderItems(providerId);
  const payouts = useQuery({ queryKey: ["my-payouts", providerId], queryFn: async () => (await supabase.from("provider_payouts").select("*").eq("provider_id", providerId).order("created_at", { ascending: false })).data ?? [] });
  const done = (q.data ?? []).filter((r) => r.status === "confirmed" || r.status === "completed");
  const gross = done.reduce((a, r) => a + Number(r.unit_price) * r.quantity, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card l="Gross bookings" v={gross} /><Card l="Platform commission (10%)" v={gross * 0.1} /><Card l="Your net" v={gross * 0.9} />
      </div>
      <h3 className="text-lg font-semibold">Payouts</h3>
      {payouts.data?.length ? payouts.data.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-4"><span>{p.currency} {Number(p.amount).toLocaleString()}</span><StatusBadge status={p.status} /></div>
      )) : <p className="text-sm text-muted-foreground">No payouts yet.</p>}
    </div>
  );
}
function Card({ l, v }: { l: string; v: number }) {
  return <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{l}</p><p className="mt-2 font-display text-3xl font-semibold">{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>;
}
