import React from "react";
import { cx } from "./cx";

/**
 * Карточка (основной контейнер Apple-стиля)
 * — Белый фон, тонкая граница, мягкие тени и скругления.
 * — Используется для секций, панелей, таблиц, профилей и т.д.
 */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "bg-[var(--bg)] border border-[var(--border)] rounded-[var(--r-lg)] shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Варианты для удобного деления контента:
 * Header — заголовок блока
 * Content — основная часть
 * Footer — нижняя часть (кнопки и т.п.)
 */

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "p-6 pb-3 border-b border-[var(--border)] text-[15px] font-semibold",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("p-6 pt-3", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "p-4 border-t border-[var(--border)] flex justify-end gap-2",
        className
      )}
      {...props}
    />
  );
}