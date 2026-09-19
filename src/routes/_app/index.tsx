import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QueryError } from "@/components/empty-state";
import { CashFlowChart, ExpensePie, ProductBars } from "@/components/ledger-charts";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/lib/errors";
import { formatEgp, formatQty } from "@/lib/format";
import type { PeriodKey } from "@/lib/period";
import { LIVE } from "@/lib/query";
import { getDashboard } from "@/lib/server/dashboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const q = useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => getDashboard({ data: { period } }),
    ...LIVE,
  });

  if (q.isPending) {
    return (
      <div>
        <PageHeader eyebrow="MONO CHROME" title="صافي الصندوق" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div>
        <PageHeader eyebrow="الصندوق" title="لوحة التحكم" />
        <QueryError message={errMessage(q.error)} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const d = q.data;
  const negative = d.cashNet < 0;

  return (
    <div>
      <PageHeader
        eyebrow="الصندوق"
        title="لوحة التحكم"
        action={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <section className="rounded-xl bg-ink px-5 py-6 text-accent-fg md:px-8 md:py-8">
        <p className="text-[11px] font-medium tracking-[0.24em] text-accent-fg/60">صافي الصندوق الآن</p>
        <p className={cn("mt-2 text-4xl font-medium tabular-nums tracking-tight md:text-5xl", negative && "opacity-80")}>
          {formatEgp(d.cashNet)}
        </p>
        <p className="mt-2 text-sm text-accent-fg/60">تحصيلات − سداد مشتريات − مصاريف</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="تحصيلات الفترة" value={d.period.collections} />
        <Kpi label="مبيعات الفترة" value={d.period.sales} />
        <Kpi label="مشتريات / سداد" value={d.period.purchasePaid} />
        <Kpi label="مصاريف الفترة" value={d.period.expenses} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="صافي الفترة" value={d.period.net} />
        <Kpi label="مستحق عند العملاء" value={d.receivables} />
        <Kpi label="قيمة المخزون" value={d.stockValue} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)] lg:col-span-3">
          <h2 className="text-sm font-medium">حركة الصندوق</h2>
          <p className="mb-3 text-xs text-muted">تحصيل، سداد شراء، مصروف</p>
          <CashFlowChart series={d.series} />
        </article>
        <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)] lg:col-span-2">
          <h2 className="text-sm font-medium">المصاريف حسب التصنيف</h2>
          <ExpensePie rows={d.expensesByCategory} />
          <ul className="mt-1 space-y-1">
            {d.expensesByCategory.map((row) => (
              <li key={row.category} className="flex justify-between text-xs">
                <span className="text-muted">{row.category}</span>
                <span className="tabular-nums">{formatEgp(row.amount)}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-medium">أعلى المنتجات مبيعاً</h2>
          <ProductBars rows={d.topProducts} />
        </article>
        <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">مخزون منخفض</h2>
            <Link to="/products" className="text-xs text-muted hover:text-ink">
              كل المنتجات
            </Link>
          </div>
          {d.lowStock.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">المخزون في وضع مريح</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{p.name}</span>
                  <span className="tabular-nums text-muted">{formatQty(p.stockQty)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <article className={cn("rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-card)]", className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums tracking-tight md:text-xl">{formatEgp(value)}</p>
    </article>
  );
}
