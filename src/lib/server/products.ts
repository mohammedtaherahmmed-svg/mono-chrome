import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { nid, num } from "@/lib/utils";
import { requireManager, requireMember } from "./access";
import { recordAudit } from "./audit";

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  notes: string;
  createdAt: string;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  cost_price: unknown;
  sale_price: unknown;
  stock_qty: unknown;
  notes: string | null;
  created_at: string;
};

function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku ?? "",
    category: r.category ?? "",
    unit: r.unit,
    costPrice: num(r.cost_price),
    salePrice: num(r.sale_price),
    stockQty: num(r.stock_qty),
    notes: r.notes ?? "",
    createdAt: r.created_at,
  };
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Product[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const rows = await sql<ProductRow>`
      select id, name, sku, category, unit, cost_price, sale_price, stock_qty, notes,
             created_at::text as created_at
      from products
      where company_id = ${companyId}
      order by name asc
    `;
    return rows.map(mapProduct);
  });

export type ProductInput = {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  notes?: string;
};

export const createProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ProductInput) => d)
  .handler(async ({ context, data }): Promise<Product> => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("اسم المنتج مطلوب");
    const id = nid();
    const rows = await sql<ProductRow>`
      insert into products (
        id, company_id, name, sku, category, unit,
        cost_price, sale_price, stock_qty, notes, created_by
      ) values (
        ${id}, ${companyId}, ${name}, ${data.sku?.trim() || null},
        ${data.category?.trim() || null}, ${data.unit?.trim() || "قطعة"},
        ${data.costPrice}, ${data.salePrice}, ${data.stockQty},
        ${data.notes?.trim() || null}, ${userId}
      )
      returning id, name, sku, category, unit, cost_price, sale_price, stock_qty, notes,
                created_at::text as created_at
    `;
    await recordAudit(sql, { companyId, actorUserId: userId, action: "create", entity: "product", entityId: id, details: { name } });
    return mapProduct(rows[0]!);
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ProductInput & { id: string }) => d)
  .handler(async ({ context, data }): Promise<Product> => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("اسم المنتج مطلوب");
    const rows = await sql<ProductRow>`
      update products set
        name = ${name},
        sku = ${data.sku?.trim() || null},
        category = ${data.category?.trim() || null},
        unit = ${data.unit?.trim() || "قطعة"},
        cost_price = ${data.costPrice},
        sale_price = ${data.salePrice},
        stock_qty = ${data.stockQty},
        notes = ${data.notes?.trim() || null},
        updated_at = now()
      where id = ${data.id} and company_id = ${companyId}
      returning id, name, sku, category, unit, cost_price, sale_price, stock_qty, notes,
                created_at::text as created_at
    `;
    if (!rows[0]) throw new Error("المنتج غير موجود");
    await recordAudit(sql, { companyId, actorUserId: userId, action: "update", entity: "product", entityId: data.id, details: { name } });
    return mapProduct(rows[0]);
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId, userId } = await requireManager(context.userId);
    const deleted = await sql`
      delete from products where id = ${data.id} and company_id = ${companyId} returning id
    `;
    if (!deleted[0]) throw new Error("المنتج غير موجود");
    await recordAudit(sql, { companyId, actorUserId: userId, action: "delete", entity: "product", entityId: data.id });
    return { ok: true as const };
  });
