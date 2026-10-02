import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuthState, homeForRoles } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/discover", label: "Discover" },
  { to: "/trip-planner", label: "AI Trip Planner" },
  { to: "/trip", label: "My Trip" },
  { to: "/become-provider", label: "Become a Provider" },
] as const;

export function SiteHeader({ overlay }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user, roles } = useAuthState();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const text = overlay ? "text-on-image" : "text-foreground";

  return (
    <header className={cn("z-40 w-full", overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b bg-background/90 backdrop-blur")}>
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4">
        <Logo light={overlay} />
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={cn("text-sm font-medium opacity-90 hover:opacity-100", text)} activeProps={{ className: "text-gold" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button asChild variant={overlay ? "glass" : "outline"} size="sm">
                <Link to={homeForRoles(roles)}>My dashboard</Link>
              </Button>
              <Button variant="ghost" size="sm" className={text} onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className={text}>
                <Link to="/auth" search={{ mode: "login" }}>Login</Link>
              </Button>
              <Button asChild variant="gold" size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>Sign Up</Link>
              </Button>
            </>
          )}
        </div>
        <button className={cn("md:hidden", text)} onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-background px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="font-medium">{l.label}</Link>
            ))}
            {user ? (
              <>
                <Link to={homeForRoles(roles)} className="font-medium">My dashboard</Link>
                <Button variant="outline" onClick={signOut}>Sign out</Button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" className="flex-1"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
                <Button asChild variant="gold" className="flex-1"><Link to="/auth" search={{ mode: "signup" }}>Sign Up</Link></Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
