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

const extra: Record<string, string> = {
  PENDING_PAYMENT: styles["pending"]!, PAYMENT_FAILED: styles["failed"]!, EXPIRED: styles["draft"]!,
  AWAITING_PROVIDERS: styles["requested"]!, PARTIALLY_CONFIRMED: styles["requested"]!, PAYMENT_CONFIRMED: styles["paid"]!,
  PROCESSING: styles["UNDER_REVIEW"]!, PAYMENT_PROCESSING: styles["UNDER_REVIEW"]!, REFUND_PENDING: styles["pending"]!,
  PARTIALLY_REFUNDED: styles["refunded"]!, IN_PROGRESS: styles["completed"]!,
};

export function StatusBadge({ status }: { status: string }) {
  const s = styles[status] ?? extra[status] ?? styles[status.toLowerCase()];
  return <span className={cn("rounded-full px-3 py-1 text-xs font-bold tracking-wide", s)}>{status.replaceAll("_", " ")}</span>;
}
