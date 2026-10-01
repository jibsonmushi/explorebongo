import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, Placeholder, StatCard, NoAccess } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/provider")({
  validateSearch: (s: Record<string, unknown>) => ({ section: typeof s.section === "string" ? s.section : "overview" }),
  head: () => ({ meta: [{ title: "Provider Dashboard — ExploreBongo" }, { name: "robots", content: "noindex" }] }),
  component: ProviderDashboard,
});

const items = [
  { key: "overview", label: "Dashboard" }, { key: "business", label: "My Business" }, { key: "services", label: "My Services" },
  { key: "add-service", label: "Add Service" }, { key: "availability", label: "Availability" }, { key: "requests", label: "Booking Requests" },
  { key: "bookings", label: "Bookings" }, { key: "earnings", label: "Earnings" }, { key: "payouts", label: "Payouts" },
  { key: "reviews", label: "Reviews" }, { key: "verification", label: "Verification" }, { key: "settings", label: "Settings" },
];

function ProviderDashboard() {
  const { section } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const q = useQuery({
    queryKey: ["provider", user.id],
    queryFn: async () => {
      const [{ data: roles }, { data: pp }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("provider_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      return { isProvider: (roles ?? []).some((r) => r.role === "provider" || r.role === "admin"), pp };
    },
  });
  if (q.isLoading) return <div className="p-10">Loading…</div>;
  if (!q.data?.isProvider) return <NoAccess />;
  const pp = q.data.pp;
  const label = items.find((i) => i.key === section)?.label ?? "Dashboard";

  return (
    <DashboardShell title={label} roleLabel="Service Provider" items={items} active={section} basePath="/provider">
      {section === "overview" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold">{pp?.business_name ?? "Your business"}</h2>
            {pp && <StatusBadge status={pp.verification_status} />}
          </div>
          {pp?.verification_status !== "APPROVED" && (
            <p className="rounded-xl border bg-accent p-4 text-sm">Your business is awaiting verification. Services become visible to travelers once approved.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Services" value="0" /><StatCard label="Booking requests" value="0" />
            <StatCard label="Bookings" value="0" /><StatCard label="Earnings" value="—" hint="Payments in a later phase" />
          </div>
        </div>
      )}
      {section === "business" && pp && (
        <div className="max-w-2xl rounded-2xl border bg-card p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[["Business name", pp.business_name], ["Type", pp.provider_type], ["Country", pp.country], ["Region", pp.region], ["City", pp.city], ["Address", pp.address], ["Phone", pp.business_phone], ["Email", pp.business_email]].map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">{pp.description}</p>
        </div>
      )}
      {section === "verification" && pp && (
        <div className="max-w-xl space-y-4 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3"><span className="font-semibold">Status:</span><StatusBadge status={pp.verification_status} /></div>
          <p className="text-sm text-muted-foreground">{pp.documents_pending ? "You indicated that you'll submit verification documents." : "Please plan to submit verification documents."} Document upload will be available in a later phase.</p>
        </div>
      )}
      {!["overview", "business", "verification"].includes(section) && <Placeholder label={label} />}
    </DashboardShell>
  );
}
