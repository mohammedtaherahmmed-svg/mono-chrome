import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}
