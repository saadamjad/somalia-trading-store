import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <span className="label mb-2 block text-accent">{eyebrow}</span>
      )}
      <p
        className={cn(
          "font-display text-lg font-semibold md:text-xl",
          tone === "dark" ? "text-white" : "text-foreground"
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            tone === "dark" ? "text-white/60" : "text-muted"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
