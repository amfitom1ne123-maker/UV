import type { ReactNode } from "react";

export function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/10 p-3 shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]">
      <div className="h-8 w-8 rounded-xl bg-black/5 grid place-items-center">
        {icon}
      </div>
      <div>
        <div className="text-xs text-black/60">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
