import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, Placeholder, StatCard } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MyTrips, TripPlanner } from "@/components/dashboard/TouristSections";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({ section: typeof s["section"] === "string" ? (s["section"] as string) : undefined } as { section?: string | undefined }),
  head: () => ({ meta: [{ title: "My Dashboard — ExploreBongo" }, { name: "robots", content: "noindex" }] }),
  component: TouristDashboard,
});

const items = [
  { key: "overview", label: "Overview" }, { key: "discover", label: "Discover" }, { key: "trips", label: "My Trips" },
  { key: "favorites", label: "Favorites" }, { key: "planner", label: "AI Trip Planner" }, { key: "profile", label: "Profile" }, { key: "support", label: "Support" },
];

function TouristDashboard() {
  const section = Route.useSearch().section ?? "overview";
  const { user } = Route.useRouteContext();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  const roles = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => ((await supabase.from("user_roles").select("role").eq("user_id", user.id)).data ?? []).map((r) => r.role),
  });
  const label = items.find((i) => i.key === section)?.label ?? "Overview";

  return (
    <DashboardShell title={label} roleLabel="Traveler" items={items} active={section} basePath="/dashboard">
      {roles.data?.includes("provider") && (
        <div className="mb-6 rounded-xl border bg-accent p-4 text-sm">You have a provider account. <Link to="/provider" search={{ section: "overview" }} className="font-semibold underline">Open provider dashboard</Link></div>
      )}
      {roles.data?.includes("admin") && (
        <div className="mb-6 rounded-xl border bg-accent p-4 text-sm">You're an admin. <Link to="/admin" search={{ section: "overview" }} className="font-semibold underline">Open admin dashboard</Link></div>
      )}
      {section === "overview" && (
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold">Karibu{profile.data?.first_name ? `, ${profile.data.first_name}` : ""}!</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Trips" value={<Link to="/dashboard" search={{ section: "trips" }} className="underline">View</Link>} />
            <StatCard label="Favorites" value="0" />
            <StatCard label="Itineraries" value="0" />
          </div>
          <Button asChild variant="gold"><Link to="/discover">Explore Tanzania</Link></Button>
        </div>
      )}
      {section === "discover" && <div><Placeholder label="Discover" /><Button asChild className="mt-4"><Link to="/discover">Open public Discover page</Link></Button></div>}
      {section === "trips" && <MyTrips userId={user.id} />}
      {section === "favorites" && <Placeholder label="Favorites" />}
      {section === "planner" && <TripPlanner userId={user.id} />}
      {section === "support" && <Placeholder label="Support" />}
      {section === "profile" && profile.data && <ProfileForm profile={profile.data} onSaved={() => profile.refetch()} />}
    </DashboardShell>
  );
}

function ProfileForm({ profile, onSaved }: { profile: { id: string; first_name: string | null; last_name: string | null; phone: string | null; country: string | null; email: string | null }; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: (f["first_name"] ?? "").slice(0, 60), last_name: (f["last_name"] ?? "").slice(0, 60), phone: (f["phone"] ?? "").slice(0, 30), country: (f["country"] ?? "").slice(0, 60),
    }).eq("id", profile.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved"); onSaved();
  };
  return (
    <form onSubmit={save} className="max-w-lg space-y-4 rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">{profile.email}</p>
      {(["first_name", "last_name", "phone", "country"] as const).map((k) => (
        <div key={k} className="space-y-1.5">
          <Label htmlFor={k} className="capitalize">{k.replace("_", " ")}</Label>
          <Input id={k} name={k} defaultValue={profile[k] ?? ""} />
        </div>
      ))}
      <Button disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
