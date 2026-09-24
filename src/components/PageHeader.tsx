import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4 pb-3.5 sm:pb-5">
      <div className="min-w-0 flex-1">
        <h1 className="page-title text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "critical" | "warning" | "success" | "accent";
  icon?: ReactNode;
}) {
  const tones = {
    default: "text-foreground",
    critical: "text-critical",
    warning: "text-warning-foreground",
    success: "text-success",
    accent: "text-accent",
  } as const;

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4 shadow-card">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground line-clamp-1">
          {label}
        </p>
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      </div>
      <p
        className={cn("num mt-1 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight", tones[tone])}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
          {hint}
        </p>
      )}
    </div>
  );
}
