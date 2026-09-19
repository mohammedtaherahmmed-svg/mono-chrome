import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { eachDate, periodRange, type PeriodKey } from "@/lib/period";
import { todayIso } from "@/lib/format";
import { num, roundMoney } from "@/lib/utils";
import { requireMember } from "./access";

export type DashboardData = {
  cashNet: number;
  receivables: number;
  stockValue: number;
  productCount: number;
  period: {
    sales: number;
    purchases: number;
    collections: number;
    purchasePaid: number;
    expenses: number;
    net: number;
  };
  series: {
    date: string;
    collections: number;
    purchasePaid: number;
    expenses: number;
    net: number;
  }[];
  expensesByCategory: { category: string; amount: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { id: string; name: string; stockQty: number }[];
};

function daysAgo(days: number): string {
  const to = todayIso();
  const [y, m, d] = to.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { period: PeriodKey }) => d)
  .handler(async ({ context, data }): Promise<DashboardData> => {
    const { sql, companyId } = await requireMember(context.userId);
    const range = periodRange(data.period ?? "month");

    const cashRows = await sql<{
      collections: unknown;
      purchase_paid: unknown;
      expenses: unknown;
    }>`
      select
        coalesce((select sum(amount) from collections where company_id = ${companyId}), 0) as collections,
        coalesce((select sum(paid_amount) from purchases where company_id = ${companyId}), 0) as purchase_paid,
        coalesce((select sum(amount) from expenses where company_id = ${companyId}), 0) as expenses
    `;
    const cash = cashRows[0]!;
    const cashNet = roundMoney(
      num(cash.collections) - num(cash.purchase_paid) - num(cash.expenses),
    );

    const recvRows = await sql<{ sales: unknown; collected: unknown }>`
      select
        coalesce((select sum(total) from sales where company_id = ${companyId}), 0) as sales,
        coalesce((
          select sum(amount) from collections
          where company_id = ${companyId} and sale_id is not null
        ), 0) as collected
    `;
    const receivables = roundMoney(
      Math.max(0, num(recvRows[0]?.sales) - num(recvRows[0]?.collected)),
    );

    const stockRows = await sql<{ value: unknown; c: number }>`
      select
        coalesce(sum(stock_qty * cost_price), 0) as value,
        count(*)::int as c
      from products where company_id = ${companyId}
    `;

    const from = range?.from ?? "0001-01-01";
    const to = range?.to ?? "9999-12-31";

    const periodRows = await sql<{
      sales: unknown;
      purchases: unknown;
      collections: unknown;
      purchase_paid: unknown;
      expenses: unknown;
    }>`
      select
        coalesce((select sum(total) from sales where company_id = ${companyId} and sale_date >= ${from} and sale_date <= ${to}), 0) as sales,
        coalesce((select sum(total) from purchases where company_id = ${companyId} and purchase_date >= ${from} and purchase_date <= ${to}), 0) as purchases,
        coalesce((select sum(amount) from collections where company_id = ${companyId} and collected_at >= ${from} and collected_at <= ${to}), 0) as collections,
        coalesce((select sum(paid_amount) from purchases where company_id = ${companyId} and purchase_date >= ${from} and purchase_date <= ${to}), 0) as purchase_paid,
        coalesce((select sum(amount) from expenses where company_id = ${companyId} and expense_date >= ${from} and expense_date <= ${to}), 0) as expenses
    `;
    const p = periodRows[0]!;
    const collections = num(p.collections);
    const purchasePaid = num(p.purchase_paid);
    const expenses = num(p.expenses);

    const collSeries = await sql<{ d: string; amount: unknown }>`
      select collected_at::text as d, sum(amount) as amount
      from collections
      where company_id = ${companyId} and collected_at >= ${from} and collected_at <= ${to}
      group by collected_at
    `;
    const paySeries = await sql<{ d: string; amount: unknown }>`
      select purchase_date::text as d, sum(paid_amount) as amount
      from purchases
      where company_id = ${companyId} and purchase_date >= ${from} and purchase_date <= ${to}
      group by purchase_date
    `;
    const expSeries = await sql<{ d: string; amount: unknown }>`
      select expense_date::text as d, sum(amount) as amount
      from expenses
      where company_id = ${companyId} and expense_date >= ${from} and expense_date <= ${to}
      group by expense_date
    `;

    const mapSum = (rows: { d: string; amount: unknown }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.d, num(r.amount));
      return m;
    };
    const cMap = mapSum(collSeries);
    const pMap = mapSum(paySeries);
    const eMap = mapSum(expSeries);

    const dates = range ? eachDate(range.from, range.to) : eachDate(daysAgo(29), todayIso());

    const series = dates.map((date) => {
      const c = cMap.get(date) ?? 0;
      const pay = pMap.get(date) ?? 0;
      const e = eMap.get(date) ?? 0;
      return {
        date,
        collections: c,
        purchasePaid: pay,
        expenses: e,
        net: roundMoney(c - pay - e),
      };
    });

    const catRows = await sql<{ category: string; amount: unknown }>`
      select category, sum(amount) as amount
      from expenses
      where company_id = ${companyId} and expense_date >= ${from} and expense_date <= ${to}
      group by category
      order by sum(amount) desc
    `;

    const topRows = await sql<{ name: string; qty: unknown; revenue: unknown }>`
      select si.product_name as name, sum(si.qty) as qty, sum(si.line_total) as revenue
      from sale_items si
      join sales s on s.id = si.sale_id
      where s.company_id = ${companyId} and s.sale_date >= ${from} and s.sale_date <= ${to}
      group by si.product_name
      order by sum(si.line_total) desc
      limit 6
    `;

    const lowRows = await sql<{ id: string; name: string; stock_qty: unknown }>`
      select id, name, stock_qty from products
      where company_id = ${companyId} and stock_qty <= 5
      order by stock_qty asc, name asc
      limit 8
    `;

    return {
      cashNet,
      receivables,
      stockValue: num(stockRows[0]?.value),
      productCount: stockRows[0]?.c ?? 0,
      period: {
        sales: num(p.sales),
        purchases: num(p.purchases),
        collections,
        purchasePaid,
        expenses,
        net: roundMoney(collections - purchasePaid - expenses),
      },
      series,
      expensesByCategory: catRows.map((r) => ({
        category: r.category,
        amount: num(r.amount),
      })),
      topProducts: topRows.map((r) => ({
        name: r.name,
        qty: num(r.qty),
        revenue: num(r.revenue),
      })),
      lowStock: lowRows.map((r) => ({
        id: r.id,
        name: r.name,
        stockQty: num(r.stock_qty),
      })),
    };
  });
