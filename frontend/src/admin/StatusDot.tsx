// StatusDot.tsx
import { motion, useReducedMotion } from "framer-motion";

export default function StatusDot({
  color = "rgb(234,179,8)", // amber
  size = 10,
  pulse = true,
}: { color?: string; size?: number; pulse?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 1px rgba(0,0,0,.08) inset` }}
      />
      {!reduce && pulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: [0.35, 0.05, 0.35], scale: [1, 1.35, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
