import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageIntro } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/checkout/$bookingId")({
  head: () => ({ meta: [{ title: "Checkout — ExploreBongo" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

const PAID = ["PAID", "REFUND_PENDING", "REFUNDED", "PARTIALLY_REFUNDED"];

function Checkout() {
  const { bookingId } = Route.useParams();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const q = useQuery({
    queryKey: ["checkout", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("id,reference,status,payment_state,total_amount,currency,booking_items(id,date,quantity,unit_price,status,services(title),provider_profiles(business_name)),payments(id,state,amount,currency,transaction_reference,created_at)")
        .eq("id", bookingId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const b = q.data;
  if (q.isLoading) return <PublicLayout><p className="p-10">Loading…</p></PublicLayout>;
  if (!b) return <PublicLayout><p className="p-10">Booking not found.</p></PublicLayout>;

  const items = b.booking_items.filter((i) => i.status !== "cancelled");
  const subtotal = items.reduce((a, i) => a + Number(i.unit_price) * i.quantity, 0);
  const payments = [...b.payments].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const paid = payments.find((p) => PAID.includes(p.state));
  const last = payments[0];

  const pay = async (success: boolean) => {
    if (lock.current) return; // double-click guard
    lock.current = true; setBusy(true);
    try {
      const { data: pid, error } = await supabase.rpc("start_checkout", { _booking_id: b.id });
      if (error) throw error;
      const { data: res, error: e2 } = await supabase.rpc("complete_test_payment", { _payment_id: pid, _success: success });
      if (e2) throw e2;
      res === "PAID" ? toast.success("Test payment successful") : toast.error("Test payment failed");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Payment error"); }
    lock.current = false; setBusy(false); q.refetch();
  };

  return (
    <PublicLayout>
      <PageIntro eyebrow="Checkout" title={`Booking ${b.reference ?? ""}`}>Review your trip and pay.</PageIntro>
      <section className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <div className="flex flex-wrap items-center gap-2 text-sm">Booking status: <StatusBadge status={b.payment_state} />
          {last && <>Payment: <StatusBadge status={last.state} /></>}</div>
        <div className="divide-y rounded-2xl border bg-card">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
              <div><p className="font-semibold">{i.services?.title}</p><p className="text-muted-foreground">{i.provider_profiles?.business_name} · {i.date} · {i.quantity} guest(s)</p></div>
              <div className="text-right"><p>{b.currency} {Number(i.unit_price).toLocaleString()} × {i.quantity}</p><p className="font-semibold">{b.currency} {(Number(i.unit_price) * i.quantity).toLocaleString()}</p></div>
            </div>
          ))}
          <div className="flex justify-between p-4 text-sm"><span>Subtotal</span><span>{b.currency} {subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between p-4 text-lg font-semibold"><span>Total ({b.currency})</span><span>{b.currency} {subtotal.toLocaleString()}</span></div>
        </div>
        {paid ? (
          <div className="rounded-2xl border bg-accent p-5">
            <p className="font-semibold">Paid — reference {paid.transaction_reference}</p>
            <p className="text-sm text-muted-foreground">Providers will now confirm their parts of your trip.</p>
            <Button asChild className="mt-3"><Link to="/dashboard" search={{ section: "trips" }}>View booking status</Link></Button>
          </div>
        ) : b.status === "cancelled" ? <p className="text-muted-foreground">This booking is cancelled.</p> : (
          <div className="rounded-2xl border-4 border-dashed border-destructive bg-destructive/10 p-6">
            <p className="flex items-center gap-2 font-display text-xl font-bold text-destructive"><FlaskConical className="h-5 w-5" />TEST PAYMENT — NO REAL MONEY</p>
            <p className="mt-1 text-sm">This is a simulated payment for testing. No card or mobile money is charged.</p>
            {last?.state === "FAILED" && <p className="mt-2 text-sm font-semibold text-destructive">Last attempt failed. You can try again.</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={busy} onClick={() => pay(true)}>Test Payment — SUCCESS</Button>
              <Button disabled={busy} variant="destructive" onClick={() => pay(false)}>Test Payment — FAILED</Button>
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
