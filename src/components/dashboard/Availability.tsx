import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProviderServices } from "./ProviderSections";

export function AvailabilityManager({ providerId }: { providerId: string }) {
  const svc = useProviderServices(providerId);
  const [serviceId, setServiceId] = useState("");
  const sid = serviceId || svc.data?.[0]?.id || "";
  const rows = useQuery({
    queryKey: ["availability", sid],
    enabled: !!sid,
    queryFn: async () => (await supabase.from("availability").select("*").eq("service_id", sid).gte("date", new Date().toISOString().slice(0, 10)).order("date")).data ?? [],
  });
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const capacity = Number(f["capacity"]);
    if (!f["date"] || !(capacity >= 0)) { toast.error("Pick a date and capacity"); return; }
    const existing = rows.data?.find((r) => r.date === f["date"]);
    if (existing && capacity < existing.booked) { toast.error(`Already ${existing.booked} booked on that date`); return; }
    const { error } = existing
      ? await supabase.from("availability").update({ capacity }).eq("id", existing.id)
      : await supabase.from("availability").insert({ service_id: sid, date: f["date"], capacity, booked: 0 });
    if (error) { toast.error(error.message); return; }
    toast.success("Availability saved"); rows.refetch();
  };
  if (!svc.data?.length) return <p className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">Add a service first.</p>;
  return (
    <div className="max-w-3xl space-y-6">
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sid} onChange={(e) => setServiceId(e.target.value)}>
        {svc.data.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5">
        <div className="space-y-1.5"><Label htmlFor="av-date">Date</Label><Input id="av-date" name="date" type="date" min={new Date().toISOString().slice(0, 10)} /></div>
        <div className="space-y-1.5"><Label htmlFor="av-cap">Spots available</Label><Input id="av-cap" name="capacity" type="number" min={0} className="w-32" /></div>
        <Button>Save date</Button>
        <p className="w-full text-xs text-muted-foreground">Dates you don't set use your service's default capacity. Set 0 to block a date.</p>
      </form>
      <div className="space-y-2">
        {rows.data?.length ? rows.data.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
            <span className="font-medium">{r.date}</span>
            <span>{r.booked} booked · {Math.max(r.capacity - r.booked, 0)} of {r.capacity} left</span>
          </div>
        )) : <p className="text-sm text-muted-foreground">No dates set yet.</p>}
      </div>
    </div>
  );
}
