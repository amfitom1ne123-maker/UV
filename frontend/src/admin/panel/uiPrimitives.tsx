import * as React from "react";

// fallback cx (если нет utils.cn)
export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/**
 * Apple-like UI primitives: Button, Card, Badge, Input, Select, Divider
 * Минимализм: большие радиусы, тонкие границы, деликатные тени.
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "solid" | "ghost" | "success" | "destructive";
  size?: "sm" | "md" | "lg";
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition " +
  "disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10";
const btnSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};
const btnVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  outline: "border border-black/80 text-black bg-white hover:bg-black/5 active:scale-[0.98]",
  solid: "bg-black text-white hover:bg-black/90 active:scale-[0.98]",
  ghost: "text-black/80 hover:bg-black/5 active:scale-[0.98]",
  success: "bg-black text-white hover:bg-black/90 active:scale-[0.98]",
  destructive:
    "bg-[rgb(220,38,38)] text-white hover:bg-[rgb(185,28,28)] active:scale-[0.98]",
};

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(btnBase, btnSizes[size], btnVariants[variant], className)}
      {...props}
    />
  );
}

export function Card({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  color = "gray",
  className = "",
  children,
}: {
  color?: "gray" | "purple" | "green" | "red" | "blue" | "orange";
  className?: string;
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    gray: "bg-black/5 text-black/70",
    purple: "bg-[rgba(99,102,241,0.12)] text-[rgb(79,70,229)]",
    green: "bg-[rgba(34,197,94,0.12)] text-[rgb(21,128,61)]",
    red: "bg-[rgba(239,68,68,0.12)] text-[rgb(185,28,28)]",
    blue: "bg-[rgba(59,130,246,0.12)] text-[rgb(37,99,235)]",
    orange: "bg-[rgba(251,146,60,0.14)] text-[rgb(194,65,12)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        map[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ComponentType<any> }
>(({ className = "", icon: Icon, ...props }, ref) => {
  return (
    <div className="relative w-full">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
      )}
      <input
        ref={ref}
        className={cx(
          "w-full rounded-2xl border border-black/10 bg-white text-black placeholder:text-black/40",
          "px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10",
          Icon ? "pl-9" : "",
          className
        )}
        {...props}
      />
    </div>
  );
});
Input.displayName = "Input";

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "rounded-2xl border border-black/10 bg-white text-black px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-black/10 transition appearance-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={cx("h-px bg-black/10", className)} />;
}
