import React from "react";
import { cx } from "./cx";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cx("w-full border-separate border-spacing-0", className)} {...props} />
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}
export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx("hover:bg-black/[.03] transition", className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        "sticky top-0 z-10 bg-white text-left text-[12.5px] font-semibold text-[var(--muted)] " +
          "border-b border-[var(--border)] px-3 py-2",
        className
      )}
      {...props}
    />
  );
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("px-3 py-3 border-b border-[var(--border)]", className)} {...props} />;
}