import { todayIso } from "./format";

export type PeriodKey = "today" | "week" | "month" | "year" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "اليوم",
  week: "أسبوع",
  month: "الشهر",
  year: "السنة",
  all: "الكل",
};

export function periodRange(key: PeriodKey): { from: string; to: string } | null {
  const to = todayIso();
  if (key === "all") return null;
  const [ys, ms, ds] = to.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (key === "today") return { from: to, to };
  if (key === "week") {
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 6);
    return { from: date.toISOString().slice(0, 10), to };
  }
  if (key === "month") {
    return { from: `${ys}-${ms}-01`, to };
  }
  return { from: `${ys}-01-01`, to };
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
