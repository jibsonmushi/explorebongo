import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";

const Empty = ({ t }: { t: string }) => <p className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">{t}</p>;
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">{children}</div>;
const d = (s: string) => new Date(s).toLocaleDateString();

export function AdminServices() {
  const q = useQuery({ queryKey: ["admin-services"], queryFn: async () => (await supabase.from("services").select("id,title,price,currency,is_published,created_at,provider_profiles(business_name,verification_status)").order("created_at", { ascending: false })).data ?? [] });
  const set = async (id: string, is_published: boolean) => {
    const { error } = await supabase.from("services").update({ is_published }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(is_published ? "Service approved" : "Service unpublished"); q.refetch();
  };
  if (!q.data?.length) return <Empty t="No services yet." />;
  return <div className="space-y-3">{q.data.map((s) => (
    <Row key={s.id}>
      <div className="min-w-0 flex-1"><p className="font-semibold">{s.title}</p><p className="text-xs text-muted-foreground">{s.provider_profiles?.business_name} · {s.currency} {Number(s.price).toLocaleString()}</p></div>
      {s.provider_profiles && <StatusBadge status={s.provider_profiles.verification_status} />}
      <StatusBadge status={s.is_published ? "LIVE" : "IN REVIEW"} />
      {s.is_published ? <Button size="sm" variant="outline" onClick={() => set(s.id, false)}>Unpublish</Button> : <Button size="sm" onClick={() => set(s.id, true)}>Approve</Button>}
    </Row>))}</div>;
}

export function AdminBookings() {
  const q = useQuery({ queryKey: ["admin-bookings"], queryFn: async () => (await supabase.from("bookings").select("id,status,total_amount,currency,created_at,booking_items(id,status,quantity,services(title))").order("created_at", { ascending: false })).data ?? [] });
  if (!q.data?.length) return <Empty t="No bookings yet." />;
  return <div className="space-y-3">{q.data.map((b) => (
    <div key={b.id} className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{d(b.created_at)} · {b.currency} {Number(b.total_amount).toLocaleString()}</p><StatusBadge status={b.status} /></div>
      <ul className="mt-2 text-sm text-muted-foreground">{b.booking_items.map((i) => <li key={i.id}>{i.services?.title} × {i.quantity} — {i.status}</li>)}</ul>
    </div>))}</div>;
}

export function AdminPayments() {
  const q = useQuery({ queryKey: ["admin-payments"], queryFn: async () => (await supabase.from("payments").select("*").order("created_at", { ascending: false })).data ?? [] });
  const c = useQuery({ queryKey: ["admin-commissions"], queryFn: async () => (await supabase.from("commissions").select("amount")).data ?? [] });
  const total = (c.data ?? []).reduce((a, r) => a + Number(r.amount), 0);
  return <div className="space-y-4">
    <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Commission earned (all bookings)</p><p className="mt-2 font-display text-3xl font-semibold">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
    {q.data?.length ? q.data.map((p) => <Row key={p.id}><span className="flex-1">{d(p.created_at)} · {p.currency} {Number(p.amount).toLocaleString()}</span><StatusBadge status={p.status} /></Row>) : <Empty t="No payments yet — online payment isn't connected." />}
  </div>;
}

export function AdminPayouts() {
  const q = useQuery({ queryKey: ["admin-payouts"], queryFn: async () => (await supabase.from("provider_payouts").select("id,amount,currency,status,created_at,provider_profiles(business_name)").order("created_at", { ascending: false })).data ?? [] });
  const markPaid = async (id: string) => {
    const { error } = await supabase.from("provider_payouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; } toast.success("Marked paid"); q.refetch();
  };
  if (!q.data?.length) return <Empty t="No payouts yet." />;
  return <div className="space-y-3">{q.data.map((p) => <Row key={p.id}><span className="flex-1">{p.provider_profiles?.business_name} · {p.currency} {Number(p.amount).toLocaleString()}</span><StatusBadge status={p.status} />{p.status === "pending" && <Button size="sm" onClick={() => markPaid(p.id)}>Mark paid</Button>}</Row>)}</div>;
}

export function AdminReviews() {
  const q = useQuery({ queryKey: ["admin-reviews"], queryFn: async () => (await supabase.from("reviews").select("id,rating,comment,created_at,services(title)").order("created_at", { ascending: false })).data ?? [] });
  const del = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; } toast.success("Review removed"); q.refetch();
  };
  if (!q.data?.length) return <Empty t="No reviews yet." />;
  return <div className="space-y-3">{q.data.map((r) => <Row key={r.id}><div className="min-w-0 flex-1"><p className="font-semibold">{r.services?.title} · {"★".repeat(r.rating)}</p><p className="text-sm text-muted-foreground">{r.comment}</p></div><Button size="sm" variant="outline" onClick={() => del(r.id)}>Remove</Button></Row>)}</div>;
}

export function AdminSupport() {
  const q = useQuery({ queryKey: ["admin-support"], queryFn: async () => (await supabase.from("support_tickets").select("*").order("created_at", { ascending: false })).data ?? [] });
  const close = async (id: string) => {
    const { error } = await supabase.from("support_tickets").update({ status: "closed" }).eq("id", id);
    if (error) { toast.error(error.message); return; } toast.success("Ticket closed"); q.refetch();
  };
  if (!q.data?.length) return <Empty t="No support tickets." />;
  return <div className="space-y-3">{q.data.map((t) => <Row key={t.id}><div className="min-w-0 flex-1"><p className="font-semibold">{t.subject}</p><p className="text-sm text-muted-foreground">{t.message}</p></div><span className="text-xs uppercase">{t.status}</span>{t.status !== "closed" && <Button size="sm" onClick={() => close(t.id)}>Close</Button>}</Row>)}</div>;
}

export function AdminAudit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  if (!q.data?.length) return <Empty t="No audit entries yet." />;
  return <div className="space-y-2">{q.data.map((a) => <Row key={a.id}><span className="flex-1 text-sm">{a.action} {a.entity ? `· ${a.entity}` : ""}</span><span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></Row>)}</div>;
}
