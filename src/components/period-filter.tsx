import { PERIOD_LABELS, type PeriodKey } from "@/lib/period";
import { cn } from "@/lib/utils";

const KEYS: PeriodKey[] = ["today", "week", "month", "year", "all"];

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (key: PeriodKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "h-9 min-w-14 rounded-md px-3 text-xs font-medium transition-colors duration-150",
            value === key ? "bg-ink text-accent-fg" : "text-muted hover:text-ink",
          )}
        >
          {PERIOD_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
