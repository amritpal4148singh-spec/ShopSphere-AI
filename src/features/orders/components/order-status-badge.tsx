import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";
import { STATUS_LABELS } from "@/utils/orders";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        status === "delivered" ? "border-primary bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
