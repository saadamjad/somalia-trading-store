import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  /** "lg" is the standard page-section heading (h2); "sm" is a compact sub-heading. */
  size?: "lg" | "sm";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  size = "lg",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <span
          className={cn(
            "label mb-2 block",
            tone === "dark" ? "text-accent" : "text-accent",
            size === "lg" && "mb-4"
          )}
        >
          {eyebrow}
        </span>
      )}
      {size === "lg" ? (
        <h2
          className={cn(
            "font-display text-3xl font-bold md:text-4xl",
            tone === "dark" ? "text-white" : "text-foreground"
          )}
        >
          {title}
        </h2>
      ) : (
        <p
          className={cn(
            "font-display text-lg font-semibold md:text-xl",
            tone === "dark" ? "text-white" : "text-foreground"
          )}
        >
          {title}
        </p>
      )}
      {description && (
        <p
          className={cn(
            size === "lg" ? "mt-4 text-sm leading-relaxed" : "mt-2 text-sm leading-relaxed",
            align === "center" && size === "lg" && "mx-auto max-w-lg",
            tone === "dark" ? "text-white/60" : "text-muted"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
