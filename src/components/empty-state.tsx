import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-card px-6 py-12 text-center shadow-[var(--shadow-card)]">
      <p className="text-sm text-danger">{message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
