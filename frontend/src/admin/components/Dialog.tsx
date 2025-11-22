import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "../panel/uiPrimitives";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ title, onClose, children }: DialogProps) {
  const reduce = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <motion.div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="relative w-[92vw] max-w-md p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">{title}</div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5">
              <svg
                className="h-4 w-4 rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </Card>
      </motion.div>
    </div>
  );
}
