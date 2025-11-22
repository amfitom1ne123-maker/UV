import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "./uiPrimitives";

export type ToastKind = "success" | "error" | "info" | "warning";

const ToastCtx = React.createContext<{
  toast: (msg: string, kind?: ToastKind) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<
    { id: number; msg: string; kind: ToastKind }[]
  >([]);
  const toast = (msg: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed right-3 top-3 z-[100] space-y-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={cx(
                "rounded-xl px-3 py-2 text-sm shadow border",
                t.kind === "success" &&
                  "bg-emerald-50 border-emerald-200 text-emerald-800",
                t.kind === "error" && "bg-red-50 border-red-200 text-red-800",
                t.kind === "warning" &&
                  "bg-amber-50 border-amber-200 text-amber-800",
                t.kind === "info" && "bg-blue-50 border-blue-200 text-blue-800"
              )}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}
