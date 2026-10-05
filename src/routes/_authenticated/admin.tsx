import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, Placeholder, StatCard, NoAccess } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AdminServices, AdminBookings, AdminPayments, AdminPayouts, AdminReviews, AdminSupport, AdminAudit } from "@/components/dashboard/AdminSections";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type VStatus = Database["public"]["Enums"]["verification_status"];
const STATUSES: VStatus[] = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>) => ({ section: typeof s["section"] === "string" ? (s["section"] as string) : undefined } as { section?: string | undefined }),
  head: () => ({ meta: [{ title: "Admin — ExploreBongo" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const items = [
  { key: "overview", label: "Dashboard" }, { key: "users", label: "Users" }, { key: "providers", label: "Providers" },
  { key: "verification", label: "Provider Verification" }, { key: "services", label: "Services" }, { key: "bookings", label: "Bookings" },
  { key: "payments", label: "Payments" }, { key: "payouts", label: "Payouts" }, { key: "reviews", label: "Reviews" },
  { key: "support", label: "Support" }, { key: "analytics", label: "Analytics" }, { key: "audit", label: "Audit Logs" }, { key: "settings", label: "Settings" },
];

function Admin() {
  const section = Route.useSearch().section ?? "overview";
  const { user } = Route.useRouteContext();
  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => ((await supabase.from("user_roles").select("role").eq("user_id", user.id)).data ?? []).some((r) => r.role === "admin"),
  });
  const providers = useQuery({
    queryKey: ["admin-providers"],
    enabled: isAdmin.data === true,
    queryFn: async () => (await supabase.from("provider_profiles").select("id,business_name,provider_type,city,region,verification_status,created_at").order("created_at", { ascending: false })).data ?? [],
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin.data === true,
    queryFn: async () => (await supabase.from("profiles").select("id,first_name,last_name,email,country,created_at").order("created_at", { ascending: false })).data ?? [],
  });

  if (isAdmin.isLoading) return <div className="p-10">Loading…</div>;
  if (!isAdmin.data) return <NoAccess />;
  const label = items.find((i) => i.key === section)?.label ?? "Dashboard";

  const setStatus = async (id: string, status: VStatus) => {
    const { error } = await supabase.from("provider_profiles").update({ verification_status: status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status set to ${status}`); providers.refetch();
  };

  return (
    <DashboardShell title={label} roleLabel="Administrator" items={items} active={section} basePath="/admin">
      {section === "overview" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Users" value={users.data?.length ?? "—"} />
          <StatCard label="Providers" value={providers.data?.length ?? "—"} />
          <StatCard label="Pending verification" value={providers.data?.filter((p) => p.verification_status === "PENDING").length ?? "—"} />
        </div>
      )}
      {section === "users" && (
        <Table head={["Name", "Email", "Country", "Joined"]} rows={(users.data ?? []).map((u) => [`${u.first_name ?? ""} ${u.last_name ?? ""}`, u.email, u.country, new Date(u.created_at).toLocaleDateString()])} />
      )}
      {(section === "providers" || section === "verification") && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>{["Business", "Type", "Location", "Status", "Change"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>
              {(providers.data ?? []).filter((p) => section === "providers" || p.verification_status !== "APPROVED").map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">{p.business_name}</td><td className="p-3">{p.provider_type}</td>
                  <td className="p-3">{[p.city, p.region].filter(Boolean).join(", ")}</td>
                  <td className="p-3"><StatusBadge status={p.verification_status} /></td>
                  <td className="p-3">
                    <Select value={p.verification_status} onValueChange={(v) => setStatus(p.id, v as VStatus)}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {providers.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No providers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {section === "services" && <AdminServices />}
      {section === "bookings" && <AdminBookings />}
      {section === "payments" && <AdminPayments />}
      {section === "payouts" && <AdminPayouts />}
      {section === "reviews" && <AdminReviews />}
      {section === "support" && <AdminSupport />}
      {section === "audit" && <AdminAudit />}
      {["analytics", "settings"].includes(section) && <Placeholder label={label} />}
    </DashboardShell>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | null)[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{head.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-3">{c || "—"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
