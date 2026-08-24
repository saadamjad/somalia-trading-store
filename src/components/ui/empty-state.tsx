import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <Icon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      )}
      <p className="font-display text-base font-semibold text-foreground">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
