import React from "react";
import { cx } from "./cx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  full?: boolean;
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[16px]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  full,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-[var(--r-lg)] transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90",
    outline:
      "border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--hover)]",
    ghost: "text-[var(--fg)] hover:bg-[var(--hover)]",
  } as const;

  return (
    <button
      className={cx(
        base,
        sizes[size],
        variants[variant],
        full && "w-full",
        className
      )}
      {...props}
    />
  );
}