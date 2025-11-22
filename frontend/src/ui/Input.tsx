import React from "react";
import { cx } from "./cx";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cx(
          "h-11 w-full rounded-[var(--r-lg)] border border-[var(--border)] bg-white px-4 text-[15px] " +
            "placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";