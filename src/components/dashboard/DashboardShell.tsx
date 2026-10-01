import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, LogOut, Construction } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NavItem = { key: string; label: string };

export function DashboardShell({
  title, roleLabel, items, active, basePath, children,
}: {
  title: string; roleLabel: string; items: NavItem[]; active: string;
  basePath: "/dashboard" | "/provider" | "/admin"; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-5"><Logo light /></div>
        <p className="px-5 pb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-sidebar-primary">{roleLabel}</p>
        <nav className="flex flex-col gap-0.5 px-3">
          {items.map((i) => (
            <Link
              key={i.key}
              to={basePath}
              search={{ section: i.key }}
              onClick={() => setOpen(false)}
              className={cn("rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent", active === i.key && "bg-sidebar-accent font-semibold text-sidebar-primary")}
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="mx-3 mt-6 flex items-center gap-2 rounded-md px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-night/50 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        </header>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function Placeholder({ label, phase = "a later phase" }: { label: string; phase?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border-2 border-dashed bg-card p-12 text-center">
      <Construction className="h-10 w-10 text-gold" />
      <h2 className="mt-4 text-2xl font-semibold">{label}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Coming soon — this feature will be built in {phase}.</p>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">No access</h1>
        <p className="mt-2 text-muted-foreground">Your account doesn't have permission to view this area.</p>
        <Link to="/dashboard" className="mt-4 inline-block font-semibold text-primary underline">Go to my dashboard</Link>
      </div>
    </div>
  );
}
