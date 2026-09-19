import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatEgp } from "@/lib/format";
import type { DashboardData } from "@/lib/server/dashboard";
import { roundMoney } from "@/lib/utils";

const MONO = [
  "var(--color-ink)",
  "var(--color-muted)",
  "var(--color-subtle)",
  "var(--color-line-strong)",
  "var(--color-line)",
  "var(--color-paper)",
];

const tipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-ink)",
};

export function CashFlowChart({ series }: { series: DashboardData["series"] }) {
  const data = series.map((s) => ({
    ...s,
    label: formatDate(s.date).slice(0, 5),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value, name) => [
              formatEgp(Number(value ?? 0)),
              name === "collections"
                ? "تحصيل"
                : name === "purchasePaid"
                  ? "سداد شراء"
                  : name === "expenses"
                    ? "مصروف"
                    : "صافي",
            ]}
          />
          <Area
            type="monotone"
            dataKey="collections"
            stroke="var(--color-ink)"
            fill="var(--color-ink)"
            fillOpacity={0.12}
            strokeWidth={1.6}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="var(--color-muted)"
            fill="var(--color-muted)"
            fillOpacity={0.1}
            strokeWidth={1.4}
          />
          <Area
            type="monotone"
            dataKey="purchasePaid"
            stroke="var(--color-ink)"
            fill="none"
            strokeDasharray="4 4"
            strokeWidth={1.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpensePie({ rows }: { rows: DashboardData["expensesByCategory"] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">لا مصاريف في الفترة</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="amount"
            nameKey="category"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={MONO[i % MONO.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tipStyle} formatter={(v) => formatEgp(Number(v ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProductBars({
  rows,
  empty = "لا مبيعات في الفترة",
}: {
  rows: DashboardData["topProducts"];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-line)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 11, fill: "var(--color-ink)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => formatEgp(Number(v ?? 0))} />
          <Bar dataKey="revenue" fill="var(--color-ink)" radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AmountTrend({
  rows,
  empty = "لا بيانات للرسم بعد",
}: {
  rows: { date: string; amount: number }[];
  empty?: string;
}) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    grouped.set(row.date, roundMoney((grouped.get(row.date) ?? 0) + row.amount));
  }
  const data = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, amount]) => ({ date, amount, label: formatDate(date).slice(0, 5) }));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => formatEgp(Number(v ?? 0))} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--color-ink)"
            fill="var(--color-ink)"
            fillOpacity={0.12}
            strokeWidth={1.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
