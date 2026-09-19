import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { nid, num, roundMoney } from "@/lib/utils";
import { requireManager, requireMember } from "./access";

export type SaleItem = {
  id: string;
  productId: string | null;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type Sale = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  saleDate: string;
  total: number;
  collected: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
  notes: string;
  items: SaleItem[];
  createdAt: string;
};

type SaleHead = {
  id: string;
  invoice_number: string;
  customer_name: string;
  sale_date: string;
  total: unknown;
  notes: string | null;
  created_at: string;
  collected: unknown;
};

function statusOf(total: number, collected: number): Sale["status"] {
  if (collected <= 0) return "unpaid";
  if (collected + 0.001 >= total) return "paid";
  return "partial";
}

export const listSales = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Sale[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const heads = await sql<SaleHead>`
      select
        s.id, s.invoice_number, s.customer_name, s.sale_date::text as sale_date,
        s.total, s.notes, s.created_at::text as created_at,
        coalesce((
          select sum(c.amount) from collections c where c.sale_id = s.id
        ), 0) as collected
      from sales s
      where s.company_id = ${companyId}
      order by s.sale_date desc, s.created_at desc
    `;
    if (heads.length === 0) return [];
    const ids = heads.map((h) => h.id);
    const itemRows = await sql.query<{
      id: string;
      sale_id: string;
      product_id: string | null;
      product_name: string;
      qty: unknown;
      unit_price: unknown;
      line_total: unknown;
    }>(
      `select id, sale_id, product_id, product_name, qty, unit_price, line_total
       from sale_items where sale_id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
      ids,
    );
    const bySale = new Map<string, SaleItem[]>();
    for (const it of itemRows) {
      const list = bySale.get(it.sale_id) ?? [];
      list.push({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name,
        qty: num(it.qty),
        unitPrice: num(it.unit_price),
        lineTotal: num(it.line_total),
      });
      bySale.set(it.sale_id, list);
    }
    return heads.map((h) => {
      const total = num(h.total);
      const collected = num(h.collected);
      return {
        id: h.id,
        invoiceNumber: h.invoice_number,
        customerName: h.customer_name,
        saleDate: h.sale_date,
        total,
        collected,
        remaining: roundMoney(Math.max(0, total - collected)),
        status: statusOf(total, collected),
        notes: h.notes ?? "",
        items: bySale.get(h.id) ?? [],
        createdAt: h.created_at,
      };
    });
  });

export type SaleInput = {
  customerName: string;
  saleDate: string;
  notes?: string;
  items: { productId: string; qty: number; unitPrice: number }[];
  collectNow?: number;
  collectMethod?: string;
};

export const createSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: SaleInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const customerName = data.customerName.trim();
    if (!customerName) throw new Error("اسم العميل مطلوب");
    if (!data.saleDate) throw new Error("تاريخ البيع مطلوب");
    const items = data.items.filter((i) => i.productId && i.qty > 0);
    if (items.length === 0) throw new Error("أضف صنفاً واحداً على الأقل");

    const applied: { id: string; qty: number; name: string }[] = [];
    try {
      let total = 0;
      const prepared: {
        productId: string;
        name: string;
        qty: number;
        unitPrice: number;
        lineTotal: number;
      }[] = [];

      for (const item of items) {
        const products = await sql<{
          id: string;
          name: string;
          stock_qty: unknown;
        }>`
          select id, name, stock_qty from products
          where id = ${item.productId} and company_id = ${companyId}
          limit 1
        `;
        const product = products[0];
        if (!product) throw new Error("منتج غير موجود");
        const stock = num(product.stock_qty);
        if (item.qty > stock + 1e-9) {
          throw new Error(`المخزون لا يكفي لـ ${product.name} (المتاح ${stock})`);
        }
        const lineTotal = roundMoney(item.qty * item.unitPrice);
        total = roundMoney(total + lineTotal);
        prepared.push({
          productId: product.id,
          name: product.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal,
        });
      }

      for (const item of prepared) {
        const updated = await sql`
          update products
          set stock_qty = stock_qty - ${item.qty}, updated_at = now()
          where id = ${item.productId} and company_id = ${companyId}
            and stock_qty >= ${item.qty}
          returning id
        `;
        if (!updated[0]) {
          throw new Error(`المخزون لا يكفي لـ ${item.name}`);
        }
        applied.push({ id: item.productId, qty: item.qty, name: item.name });
      }

      const countRows = await sql<{ c: number }>`
        select count(*)::int as c from sales where company_id = ${companyId}
      `;
      const invoiceNumber = `S-${String((countRows[0]?.c ?? 0) + 1).padStart(4, "0")}`;
      const saleId = nid();
      await sql`
        insert into sales (
          id, company_id, invoice_number, customer_name, sale_date, total, notes, created_by
        ) values (
          ${saleId}, ${companyId}, ${invoiceNumber}, ${customerName},
          ${data.saleDate}, ${total}, ${data.notes?.trim() || null}, ${userId}
        )
      `;
      for (const item of prepared) {
        await sql`
          insert into sale_items (
            id, sale_id, product_id, product_name, qty, unit_price, line_total
          ) values (
            ${nid()}, ${saleId}, ${item.productId}, ${item.name},
            ${item.qty}, ${item.unitPrice}, ${item.lineTotal}
          )
        `;
      }

      const collectNow = Math.min(num(data.collectNow), total);
      if (collectNow > 0) {
        await sql`
          insert into collections (
            id, company_id, sale_id, customer_name, amount, collected_at, method, created_by
          ) values (
            ${nid()}, ${companyId}, ${saleId}, ${customerName},
            ${collectNow}, ${data.saleDate}, ${data.collectMethod?.trim() || "نقدي"}, ${userId}
          )
        `;
      }
      return { id: saleId, invoiceNumber };
    } catch (err) {
      for (const item of applied.reverse()) {
        await sql`
          update products
          set stock_qty = stock_qty + ${item.qty}, updated_at = now()
          where id = ${item.id} and company_id = ${companyId}
        `;
      }
      throw err;
    }
  });

export const deleteSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const linked = await sql<{ c: number }>`
      select count(*)::int as c from collections where sale_id = ${data.id}
    `;
    if ((linked[0]?.c ?? 0) > 0) {
      throw new Error("لا يمكن حذف فاتورة عليها تحصيلات — احذف التحصيل أولاً");
    }
    const items = await sql<{ product_id: string | null; qty: unknown }>`
      select si.product_id, si.qty
      from sale_items si
      join sales s on s.id = si.sale_id
      where s.id = ${data.id} and s.company_id = ${companyId}
    `;
    const deleted = await sql`
      delete from sales where id = ${data.id} and company_id = ${companyId} returning id
    `;
    if (!deleted[0]) throw new Error("الفاتورة غير موجودة");
    for (const item of items) {
      if (!item.product_id) continue;
      await sql`
        update products
        set stock_qty = stock_qty + ${num(item.qty)}, updated_at = now()
        where id = ${item.product_id} and company_id = ${companyId}
      `;
    }
    return { ok: true as const };
  });
