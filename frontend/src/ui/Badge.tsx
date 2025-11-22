import React from "react";
import { cx } from "./cx";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-black/[.06] text-[var(--fg)]",
  success: "bg-green-600/10 text-green-700",
  warning: "bg-amber-500/10 text-amber-700",
  danger:  "bg-red-500/10 text-red-700",
};

export function Badge({ className, tone = "neutral", ...props }: Props) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-[999px] px-2.5 h-7 text-[12.5px] font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}