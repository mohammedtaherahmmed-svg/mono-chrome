import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: "default" | "muted" | "danger" | "solid";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "default" && "bg-ink/8 text-ink",
        tone === "muted" && "bg-line/80 text-muted",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "solid" && "bg-ink text-accent-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
