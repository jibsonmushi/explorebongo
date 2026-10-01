import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="bg-night text-night-foreground">
      <div className="kente" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm opacity-70">Discover • Explore • Experience Tanzania</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Travelers</p>
          <Link to="/discover" className="block opacity-80 hover:opacity-100">Discover</Link>
          <Link to="/trip-planner" className="block opacity-80 hover:opacity-100">AI Trip Planner</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="block opacity-80 hover:opacity-100">Create account</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Providers</p>
          <Link to="/become-provider" className="block opacity-80 hover:opacity-100">Become a Provider</Link>
          <Link to="/provider/register" className="block opacity-80 hover:opacity-100">Register your business</Link>
        </div>
      </div>
      <div className="border-t border-sidebar-border py-5 text-center text-xs opacity-60">© {new Date().getFullYear()} ExploreBongo. All rights reserved.</div>
    </footer>
  );
}
