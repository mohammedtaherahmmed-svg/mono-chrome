import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { nid, num, roundMoney } from "@/lib/utils";
import { requireManager, requireMember } from "./access";

export type Collection = {
  id: string;
  saleId: string | null;
  invoiceNumber: string | null;
  customerName: string;
  amount: number;
  collectedAt: string;
  method: string;
  notes: string;
  createdAt: string;
};

export const listCollections = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Collection[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const rows = await sql<{
      id: string;
      sale_id: string | null;
      invoice_number: string | null;
      customer_name: string;
      amount: unknown;
      collected_at: string;
      method: string;
      notes: string | null;
      created_at: string;
    }>`
      select
        c.id, c.sale_id, s.invoice_number, c.customer_name, c.amount,
        c.collected_at::text as collected_at, c.method, c.notes,
        c.created_at::text as created_at
      from collections c
      left join sales s on s.id = c.sale_id
      where c.company_id = ${companyId}
      order by c.collected_at desc, c.created_at desc
    `;
    return rows.map((r) => ({
      id: r.id,
      saleId: r.sale_id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      amount: num(r.amount),
      collectedAt: r.collected_at,
      method: r.method,
      notes: r.notes ?? "",
      createdAt: r.created_at,
    }));
  });

export type CollectionInput = {
  saleId?: string | null;
  customerName: string;
  amount: number;
  collectedAt: string;
  method?: string;
  notes?: string;
};

export const createCollection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CollectionInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const amount = roundMoney(num(data.amount));
    if (amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    if (!data.collectedAt) throw new Error("تاريخ التحصيل مطلوب");
    let customerName = data.customerName.trim();
    let saleId: string | null = data.saleId?.trim() || null;
    if (saleId) {
      const sale = await sql<{ id: string; customer_name: string; total: unknown }>`
        select id, customer_name, total from sales
        where id = ${saleId} and company_id = ${companyId}
        limit 1
      `;
      if (!sale[0]) throw new Error("الفاتورة غير موجودة");
      if (!customerName) customerName = sale[0].customer_name;
      const collectedRows = await sql<{ collected: unknown }>`
        select coalesce(sum(amount), 0) as collected from collections where sale_id = ${saleId}
      `;
      const remaining = roundMoney(num(sale[0].total) - num(collectedRows[0]?.collected));
      if (amount > remaining + 0.001) {
        throw new Error(`المبلغ أكبر من المتبقي على الفاتورة (${remaining} ج.م)`);
      }
    }
    if (!customerName) throw new Error("اسم العميل مطلوب");
    await sql`
      insert into collections (
        id, company_id, sale_id, customer_name, amount, collected_at, method, notes, created_by
      ) values (
        ${nid()}, ${companyId}, ${saleId}, ${customerName}, ${amount},
        ${data.collectedAt}, ${data.method?.trim() || "نقدي"},
        ${data.notes?.trim() || null}, ${userId}
      )
    `;
    return { ok: true as const };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const deleted = await sql`
      delete from collections where id = ${data.id} and company_id = ${companyId} returning id
    `;
    if (!deleted[0]) throw new Error("التحصيل غير موجود");
    return { ok: true as const };
  });
