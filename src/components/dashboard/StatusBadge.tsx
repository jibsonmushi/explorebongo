import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  PENDING: "bg-gold/25 text-gold-foreground",
  UNDER_REVIEW: "bg-accent text-accent-foreground",
  APPROVED: "bg-primary text-primary-foreground",
  REJECTED: "bg-destructive text-destructive-foreground",
  SUSPENDED: "bg-earth text-primary-foreground",
  draft: "bg-muted text-muted-foreground",
  requested: "bg-gold/25 text-gold-foreground",
  pending: "bg-gold/25 text-gold-foreground",
  confirmed: "bg-primary text-primary-foreground",
  paid: "bg-primary text-primary-foreground",
  completed: "bg-accent text-accent-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  failed: "bg-destructive text-destructive-foreground",
  refunded: "bg-earth text-primary-foreground",
  open: "bg-gold/25 text-gold-foreground",
  closed: "bg-muted text-muted-foreground",
  LIVE: "bg-primary text-primary-foreground",
  "IN REVIEW": "bg-gold/25 text-gold-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("rounded-full px-3 py-1 text-xs font-bold tracking-wide", styles[status])}>{status.replace("_", " ")}</span>;
}
