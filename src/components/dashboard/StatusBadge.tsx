import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  PENDING: "bg-gold/25 text-gold-foreground",
  UNDER_REVIEW: "bg-accent text-accent-foreground",
  APPROVED: "bg-primary text-primary-foreground",
  REJECTED: "bg-destructive text-destructive-foreground",
  SUSPENDED: "bg-earth text-primary-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("rounded-full px-3 py-1 text-xs font-bold tracking-wide", styles[status])}>{status.replace("_", " ")}</span>;
}
