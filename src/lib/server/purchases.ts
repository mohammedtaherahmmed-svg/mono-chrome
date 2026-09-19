import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { nid, num, roundMoney } from "@/lib/utils";
import { requireManager, requireMember } from "./access";

export type PurchaseItem = {
  id: string;
  productId: string | null;
  productName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type Purchase = {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  purchaseDate: string;
  total: number;
  paidAmount: number;
  remaining: number;
  notes: string;
  items: PurchaseItem[];
  createdAt: string;
};

type PurchaseHead = {
  id: string;
  invoice_number: string;
  supplier_name: string;
  purchase_date: string;
  total: unknown;
  paid_amount: unknown;
  notes: string | null;
  created_at: string;
};

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Purchase[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const heads = await sql<PurchaseHead>`
      select
        id, invoice_number, supplier_name, purchase_date::text as purchase_date,
        total, paid_amount, notes, created_at::text as created_at
      from purchases
      where company_id = ${companyId}
      order by purchase_date desc, created_at desc
    `;
    if (heads.length === 0) return [];
    const ids = heads.map((h) => h.id);
    const itemRows = await sql.query<{
      id: string;
      purchase_id: string;
      product_id: string | null;
      product_name: string;
      qty: unknown;
      unit_cost: unknown;
      line_total: unknown;
    }>(
      `select id, purchase_id, product_id, product_name, qty, unit_cost, line_total
       from purchase_items where purchase_id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
      ids,
    );
    const byPurchase = new Map<string, PurchaseItem[]>();
    for (const it of itemRows) {
      const list = byPurchase.get(it.purchase_id) ?? [];
      list.push({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name,
        qty: num(it.qty),
        unitCost: num(it.unit_cost),
        lineTotal: num(it.line_total),
      });
      byPurchase.set(it.purchase_id, list);
    }
    return heads.map((h) => {
      const total = num(h.total);
      const paidAmount = num(h.paid_amount);
      return {
        id: h.id,
        invoiceNumber: h.invoice_number,
        supplierName: h.supplier_name,
        purchaseDate: h.purchase_date,
        total,
        paidAmount,
        remaining: roundMoney(Math.max(0, total - paidAmount)),
        notes: h.notes ?? "",
        items: byPurchase.get(h.id) ?? [],
        createdAt: h.created_at,
      };
    });
  });

export type PurchaseInput = {
  supplierName: string;
  purchaseDate: string;
  notes?: string;
  paidAmount: number;
  items: { productId: string; qty: number; unitCost: number }[];
};

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: PurchaseInput) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const supplierName = data.supplierName.trim();
    if (!supplierName) throw new Error("اسم المورد مطلوب");
    if (!data.purchaseDate) throw new Error("تاريخ الشراء مطلوب");
    const items = data.items.filter((i) => i.productId && i.qty > 0);
    if (items.length === 0) throw new Error("أضف صنفاً واحداً على الأقل");

    let total = 0;
    const prepared: {
      productId: string;
      name: string;
      qty: number;
      unitCost: number;
      lineTotal: number;
    }[] = [];

    for (const item of items) {
      const products = await sql<{ id: string; name: string }>`
        select id, name from products
        where id = ${item.productId} and company_id = ${companyId}
        limit 1
      `;
      const product = products[0];
      if (!product) throw new Error("منتج غير موجود");
      const lineTotal = roundMoney(item.qty * item.unitCost);
      total = roundMoney(total + lineTotal);
      prepared.push({
        productId: product.id,
        name: product.name,
        qty: item.qty,
        unitCost: item.unitCost,
        lineTotal,
      });
    }

    const paidAmount = Math.max(0, roundMoney(num(data.paidAmount)));
    const countRows = await sql<{ c: number }>`
      select count(*)::int as c from purchases where company_id = ${companyId}
    `;
    const invoiceNumber = `P-${String((countRows[0]?.c ?? 0) + 1).padStart(4, "0")}`;
    const purchaseId = nid();
    await sql`
      insert into purchases (
        id, company_id, invoice_number, supplier_name, purchase_date,
        total, paid_amount, notes, created_by
      ) values (
        ${purchaseId}, ${companyId}, ${invoiceNumber}, ${supplierName},
        ${data.purchaseDate}, ${total}, ${paidAmount},
        ${data.notes?.trim() || null}, ${userId}
      )
    `;
    for (const item of prepared) {
      await sql`
        insert into purchase_items (
          id, purchase_id, product_id, product_name, qty, unit_cost, line_total
        ) values (
          ${nid()}, ${purchaseId}, ${item.productId}, ${item.name},
          ${item.qty}, ${item.unitCost}, ${item.lineTotal}
        )
      `;
      await sql`
        update products
        set stock_qty = stock_qty + ${item.qty},
            cost_price = ${item.unitCost},
            updated_at = now()
        where id = ${item.productId} and company_id = ${companyId}
      `;
    }
    return { id: purchaseId, invoiceNumber };
  });

export const updatePurchasePaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; paidAmount: number }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const paidAmount = Math.max(0, roundMoney(num(data.paidAmount)));
    const updated = await sql`
      update purchases set paid_amount = ${paidAmount}
      where id = ${data.id} and company_id = ${companyId}
      returning id
    `;
    if (!updated[0]) throw new Error("فاتورة الشراء غير موجودة");
    return { ok: true as const };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const items = await sql<{ product_id: string | null; qty: unknown; product_name: string }>`
      select pi.product_id, pi.qty, pi.product_name
      from purchase_items pi
      join purchases p on p.id = pi.purchase_id
      where p.id = ${data.id} and p.company_id = ${companyId}
    `;
    for (const item of items) {
      if (!item.product_id) continue;
      const stock = await sql<{ stock_qty: unknown; name: string }>`
        select stock_qty, name from products
        where id = ${item.product_id} and company_id = ${companyId}
        limit 1
      `;
      if (stock[0] && num(stock[0].stock_qty) < num(item.qty) - 1e-9) {
        throw new Error(
          `لا يمكن الحذف — مخزون ${stock[0].name} أصبح أقل من كمية الفاتورة`,
        );
      }
    }
    const deleted = await sql`
      delete from purchases where id = ${data.id} and company_id = ${companyId} returning id
    `;
    if (!deleted[0]) throw new Error("فاتورة الشراء غير موجودة");
    for (const item of items) {
      if (!item.product_id) continue;
      await sql`
        update products
        set stock_qty = stock_qty - ${num(item.qty)}, updated_at = now()
        where id = ${item.product_id} and company_id = ${companyId}
      `;
    }
    return { ok: true as const };
  });
