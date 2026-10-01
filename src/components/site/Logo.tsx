import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-lg font-bold text-gold-foreground">
        B
      </span>
      <span className={cn("font-display text-xl font-semibold", light ? "text-on-image" : "text-foreground")}>
        Explore<span className="text-gold">Bongo</span>
      </span>
    </Link>
  );
}
