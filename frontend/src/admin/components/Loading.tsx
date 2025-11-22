import { motion } from "framer-motion";

export function LoadingDots({ label = "Refreshing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-black/60">
      <span>{label}</span>
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0.3, y: 0 }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            className="inline-block w-1.5 h-1.5 rounded-full bg-black/50"
          />
        ))}
      </span>
    </span>
  );
}

export function SkeletonBar({ width = "100%" }: { width?: string }) {
  return (
    <motion.div
      initial={{ backgroundPositionX: "0%" }}
      animate={{ backgroundPositionX: ["0%", "100%"] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      style={{
        width,
        height: 12,
        borderRadius: 8,
        backgroundImage:
          "linear-gradient(90deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03), rgba(0,0,0,0.08))",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
