// src/admin/Sparkline.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Плавный спарклайн:
 * - генерация "целевых" точек раз в tickMs,
 * - rAF-плавнение между prev -> next (easing),
 * - Catmull-Rom -> Bezier сглаживание пути,
 * - лёгкий градиент под линией.
 */
export default function Sparkline({
  width = 140,
  height = 36,
  color = "currentColor",
  ptsCount = 28,
  tickMs = 1200,
  jitter = 0.45, // амплитуда шума (0..1)
}: {
  width?: number;
  height?: number;
  color?: string;
  ptsCount?: number;
  tickMs?: number;
  jitter?: number;
}) {
  const reduce = useReducedMotion();

  // 0..1 числа
  const seed = () =>
    Array.from({ length: ptsCount }, () => 0.45 + (Math.random() - 0.5) * jitter);

  const [displayPts, setDisplayPts] = useState<number[]>(seed());
  const prevPts = useRef<number[]>(displayPts);
  const nextPts = useRef<number[]>(displayPts);
  const rafId = useRef<number | null>(null);
  const intervalId = useRef<number | null>(null);
  const tweenStart = useRef<number>(0);
  const tweenDur = useRef<number>(Math.max(420, tickMs * 0.55));

  // Утилиты очистки
  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      if (intervalId.current !== null) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, []);

  // Запуск живого обновления
  useEffect(() => {
    if (reduce) return;

    // Каждые tickMs «сдвигаем» массив и добавляем новый таргет
    intervalId.current = window.setInterval(() => {
      const lastTarget = nextPts.current;
      const shifted = lastTarget.slice(1);
      const newVal = clamp01(0.45 + (Math.random() - 0.5) * jitter);
      const target = [...shifted, newVal];

      // старт твина
      prevPts.current = displayPtsRef.current;
      nextPts.current = target;
      tweenStart.current = performance.now();
      tweenDur.current = Math.max(380, tickMs * 0.55);

      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(step);
    }, tickMs);

    // начальный прогон
    tweenStart.current = performance.now();
    prevPts.current = displayPts;
    nextPts.current = displayPts;
    rafId.current = requestAnimationFrame(step);

    return () => {
      if (intervalId.current !== null) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, ptsCount, tickMs, jitter]);

  // держим актуальную ссылку на отображаемые точки (для prev)
  const displayPtsRef = useRef(displayPts);
  useEffect(() => {
    displayPtsRef.current = displayPts;
  }, [displayPts]);

  // rAF шаг интерполяции
  const step = (now: number) => {
    const t0 = tweenStart.current;
    const dur = tweenDur.current;
    const p = dur === 0 ? 1 : clamp01((now - t0) / dur);
    const eased = easeOutCubic(p);

    const a = prevPts.current;
    const b = nextPts.current;

    const blended =
      a.length === b.length
        ? a.map((v, i) => v + (b[i] - v) * eased)
        : b; // на всякий случай

    setDisplayPts(blended);

    if (p < 1) {
      rafId.current = requestAnimationFrame(step);
    }
  };

  // Построение сглаженного пути (Catmull-Rom -> Bezier)
  const { linePath, areaPath } = useMemo(() => {
    const pad = 2;
    const W = width - pad * 2;
    const H = height - pad * 2;

    const toXY = (v: number, i: number) => {
      const x = pad + (i / (displayPts.length - 1)) * W;
      const y = pad + (1 - clamp01(v)) * H; // инверсия (0 = низ)
      return { x, y };
    };

    const pts = displayPts.map(toXY);

    // если мало точек — fallback в полилинию
    if (pts.length < 3) {
      const d =
        "M" +
        pts.map((p) => `${p.x},${p.y}`).join(" L");
      const a = `${d} L ${pad + W},${pad + H} L ${pad},${pad + H} Z`;
      return { linePath: d, areaPath: a };
    }

    const beziers: string[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const { c1, c2 } = catmullRomToBezier(p0, p1, p2, p3, 0.22);
      const cmd =
        (i === 0 ? `M${p1.x},${p1.y}` : "") +
        ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
      beziers.push(cmd);
    }
    const d = beziers.join(" ");
    const a = `${d} L ${pad + W},${pad + H} L ${pad},${pad + H} Z`;
    return { linePath: d, areaPath: a };
  }, [displayPts, width, height]);

  // Reduced motion: просто статичная линия без анимации
  if (reduce) {
    return (
      <svg width={width} height={height} aria-hidden>
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  }

  const gradId = useMemo(
    () => "spark_grad_" + Math.random().toString(36).slice(2),
    []
  );

  return (
    <svg width={width} height={height} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${gradId}_soft`}>
          <feDropShadow dx="0" dy="0" stdDeviation="0.6" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Подложка-область */}
      <path d={areaPath} fill={`url(#${gradId})`} opacity="0.7" />

      {/* Мягкая линия */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        filter={`url(#${gradId}_soft)`}
      />
    </svg>
  );
}

/* ---------- helpers ---------- */

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

// Catmull-Rom -> Bezier (tension = 0..1, 0.22 — мягко)
function catmullRomToBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  tension = 0.22
) {
  const t = tension;
  const c1 = {
    x: p1.x + ((p2.x - p0.x) / 6) * t * 6 * 0.5,
    y: p1.y + ((p2.y - p0.y) / 6) * t * 6 * 0.5,
  };
  const c2 = {
    x: p2.x - ((p3.x - p1.x) / 6) * t * 6 * 0.5,
    y: p2.y - ((p3.y - p1.y) / 6) * t * 6 * 0.5,
  };
  return { c1, c2 };
}
