import type { ReactNode } from "react";
import LiveNumber from "../LiveNumber";
import StatusDot from "../StatusDot";
import { Badge, Card } from "./uiPrimitives";

export type StatusDB =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "done"
  | "cancelled"
  | "cancelled_by_user";

export type StatusUI = "new" | "in_progress" | "done" | "canceled";

export function mapDbToUi(s: StatusDB): StatusUI {
  switch (s) {
    case "pending":
      return "new";
    case "confirmed":
    case "in_progress":
      return "in_progress";
    case "done":
      return "done";
    case "cancelled":
    case "cancelled_by_user":
      return "canceled";
  }
}

export function mapUiToDb(s: StatusUI): StatusDB {
  switch (s) {
    case "new":
      return "pending";
    case "in_progress":
      return "confirmed";
    case "done":
      return "done";
    case "canceled":
      return "cancelled";
  }
}

export const STATUS_META: Record<
  StatusUI,
  { label: string; badge: "gray" | "purple" | "green" | "red" | "blue" | "orange"; dot: string; pulse?: boolean }
> = {
  new: { label: "New", badge: "blue", dot: "rgb(37, 99, 235)" },
  in_progress: {
    label: "Confirmed",
    badge: "orange",
    dot: "rgb(234, 179, 8)",
    pulse: true,
  },
  done: { label: "Done", badge: "green", dot: "rgb(16, 185, 129)" },
  canceled: { label: "Canceled", badge: "red", dot: "rgb(239, 68, 68)" },
};

export function statusBadge(status: StatusUI) {
  const meta = STATUS_META[status];
  return (
    <Badge color={meta.badge}>
      <StatusDot color={meta.dot} pulse={Boolean(meta.pulse)} size={8} />
      {meta.label}
    </Badge>
  );
}

export function kpiCard(
  title: string,
  value: number | string,
  subtitle: ReactNode,
  icon: ReactNode
) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-black/60">{title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">
            {typeof value === "number" ? <LiveNumber value={value} /> : value}
          </div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-black/5 text-black/70 grid place-items-center">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-xs text-black/50">{subtitle}</div>
    </Card>
  );
}
