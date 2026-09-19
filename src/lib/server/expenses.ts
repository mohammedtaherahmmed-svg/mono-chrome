import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { nid, num, roundMoney } from "@/lib/utils";
import { requireManager, requireMember } from "./access";

export type Expense = {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  description: string;
  paymentMethod: string;
  createdAt: string;
};

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Expense[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const rows = await sql<{
      id: string;
      category: string;
      amount: unknown;
      expense_date: string;
      description: string | null;
      payment_method: string;
      created_at: string;
    }>`
      select id, category, amount, expense_date::text as expense_date,
             description, payment_method, created_at::text as created_at
      from expenses
      where company_id = ${companyId}
      order by expense_date desc, created_at desc
    `;
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      amount: num(r.amount),
      expenseDate: r.expense_date,
      description: r.description ?? "",
      paymentMethod: r.payment_method,
      createdAt: r.created_at,
    }));
  });

export type ExpenseInput = {
  category: string;
  amount: number;
  expenseDate: string;
  description?: string;
  paymentMethod?: string;
};

export const createExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ExpenseInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const amount = roundMoney(num(data.amount));
    if (amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    const category = data.category.trim();
    if (!category) throw new Error("التصنيف مطلوب");
    if (!data.expenseDate) throw new Error("التاريخ مطلوب");
    await sql`
      insert into expenses (
        id, company_id, category, amount, expense_date, description, payment_method, created_by
      ) values (
        ${nid()}, ${companyId}, ${category}, ${amount}, ${data.expenseDate},
        ${data.description?.trim() || null}, ${data.paymentMethod?.trim() || "نقدي"}, ${userId}
      )
    `;
    return { ok: true as const };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const deleted = await sql`
      delete from expenses where id = ${data.id} and company_id = ${companyId} returning id
    `;
    if (!deleted[0]) throw new Error("المصروف غير موجود");
    return { ok: true as const };
  });
