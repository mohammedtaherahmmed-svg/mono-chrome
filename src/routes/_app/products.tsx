import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCanEdit } from "@/components/company-provider";
import { EmptyState } from "@/components/empty-state";
import { ProductBars } from "@/components/ledger-charts";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LOW_STOCK, UNITS } from "@/lib/constants";
import { errMessage } from "@/lib/errors";
import { formatEgp, formatQty } from "@/lib/format";
import { LIVE } from "@/lib/query";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/server/products";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), ...LIVE });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    const s = search.trim();
    if (!s) return list;
    return list.filter((p) => `${p.name} ${p.sku} ${p.category}`.includes(s));
  }, [q.data, search]);

  const del = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المنتج");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="المخزون"
        title="المنتجات"
        action={
          canEdit ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              منتج جديد
            </Button>
          ) : null
        }
      />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو التصنيف"
        className="mb-4 max-w-sm"
      />

      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="لا منتجات بعد"
          hint="أضف أصناف الشركة ليظهر المخزون ويُخصم تلقائياً عند البيع."
          action={
            canEdit ? (
              <Button onClick={() => setEditing("new")}>إضافة أول منتج</Button>
            ) : null
          }
        />
      ) : (
        <>
          <article className="mb-4 rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-medium">قيمة المخزون</h2>
            <p className="mb-2 text-xs text-muted">حسب تكلفة الشراء الحالية</p>
            <ProductBars
              empty="لا قيمة مخزون بعد"
              rows={[...filtered]
                .sort((a, b) => b.stockQty * b.costPrice - a.stockQty * a.costPrice)
                .slice(0, 6)
                .map((p) => ({
                  name: p.name,
                  qty: p.stockQty,
                  revenue: p.stockQty * p.costPrice,
                }))}
            />
          </article>

          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <article key={p.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-start"
                    onClick={() => canEdit && setEditing(p)}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.category || p.sku || p.unit}</p>
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm(`حذف ${p.name}؟`)) del.mutate(p.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">مخزون</dt>
                    <dd className="mt-0.5 tabular-nums">
                      {formatQty(p.stockQty)} {p.unit}
                    </dd>
                    {p.stockQty <= LOW_STOCK ? (
                      <Badge tone="danger" className="mt-1">
                        منخفض
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-muted">تكلفة</dt>
                    <dd className="mt-0.5 tabular-nums">{formatEgp(p.costPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">بيع</dt>
                    <dd className="mt-0.5 tabular-nums">{formatEgp(p.salePrice)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-card)] md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">المنتج</th>
                  <th className="px-4 py-3 text-start font-medium">التصنيف</th>
                  <th className="px-4 py-3 text-start font-medium">المخزون</th>
                  <th className="px-4 py-3 text-start font-medium">تكلفة</th>
                  <th className="px-4 py-3 text-start font-medium">بيع</th>
                  {canEdit ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-start font-medium hover:underline"
                        onClick={() => canEdit && setEditing(p)}
                      >
                        {p.name}
                      </button>
                      {p.sku ? <p className="text-xs text-subtle">{p.sku}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatQty(p.stockQty)} {p.unit}
                      {p.stockQty <= LOW_STOCK ? (
                        <Badge tone="danger" className="ms-2">
                          منخفض
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatEgp(p.costPrice)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatEgp(p.salePrice)}</td>
                    {canEdit ? (
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          className="grid size-11 place-items-center text-muted hover:text-danger"
                          onClick={() => {
                            if (confirm(`حذف ${p.name}؟`)) del.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null ? (
          <ProductForm
            product={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductInput>({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? "",
    unit: product?.unit ?? "قطعة",
    costPrice: product?.costPrice ?? 0,
    salePrice: product?.salePrice ?? 0,
    stockQty: product?.stockQty ?? 0,
    notes: product?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      product
        ? updateProduct({ data: { ...form, id: product.id } })
        : createProduct({ data: form }),
    onSuccess: () => {
      toast.success(product ? "تم حفظ المنتج" : "تمت إضافة المنتج");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <DialogContent title={product ? "تعديل منتج" : "منتج جديد"}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="الاسم">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الكود">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="التصنيف">
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
        </div>
        <Field label="الوحدة">
          <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="تكلفة">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="سعر البيع">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="المخزون">
            <Input
              type="number"
              min={0}
              step="0.001"
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Button type="submit" className="mt-2 w-full" disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </form>
    </DialogContent>
  );
}
