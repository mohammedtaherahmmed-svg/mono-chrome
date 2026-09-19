import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCanEdit } from "@/components/company-provider";
import { AmountTrend } from "@/components/ledger-charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_METHODS } from "@/lib/constants";
import { errMessage } from "@/lib/errors";
import { formatDate, formatEgp, formatQty, todayIso } from "@/lib/format";
import { LIVE } from "@/lib/query";
import { listProducts, type Product } from "@/lib/server/products";
import { createCollection } from "@/lib/server/collections";
import { createSale, deleteSale, listSales, type Sale } from "@/lib/server/sales";
import { roundMoney } from "@/lib/utils";

export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
});

const STATUS: Record<Sale["status"], { label: string; tone: "solid" | "default" | "danger" }> = {
  paid: { label: "محصّلة", tone: "solid" },
  partial: { label: "جزئي", tone: "default" },
  unpaid: { label: "آجلة", tone: "danger" },
};

function SalesPage() {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sales"], queryFn: () => listSales(), ...LIVE });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    const s = search.trim();
    if (!s) return list;
    return list.filter((r) => `${r.customerName} ${r.invoiceNumber}`.includes(s));
  }, [q.data, search]);

  const totals = useMemo(() => {
    const list = q.data ?? [];
    return {
      sales: list.reduce((s, r) => s + r.total, 0),
      remaining: list.reduce((s, r) => s + r.remaining, 0),
    };
  }, [q.data]);

  const collect = useMutation({
    mutationFn: (sale: Sale) =>
      createCollection({
        data: {
          saleId: sale.id,
          customerName: sale.customerName,
          amount: sale.remaining,
          collectedAt: todayIso(),
          method: "نقدي",
        },
      }),
    onSuccess: () => {
      toast.success("تم تحصيل المتبقي");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteSale({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الفاتورة وإرجاع المخزون");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="الفواتير"
        title="المبيعات"
        action={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              فاتورة بيع
            </Button>
          ) : null
        }
      />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالعميل أو رقم الفاتورة"
        className="mb-4 max-w-sm"
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="لا مبيعات بعد"
          hint="فاتورة البيع تخصم من المخزون تلقائياً. يمكنك تحصيل المبلغ الآن أو لاحقاً."
          action={canEdit ? <Button onClick={() => setOpen(true)}>أول فاتورة</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">حركة المبيعات</h2>
                <p className="text-xs text-muted">آخر الفواتير حسب التاريخ</p>
              </div>
              <div className="text-end text-xs text-muted">
                <p>
                  الإجمالي <span className="tabular-nums text-ink">{formatEgp(totals.sales)}</span>
                </p>
                <p>
                  مستحق <span className="tabular-nums text-ink">{formatEgp(totals.remaining)}</span>
                </p>
              </div>
            </div>
            <AmountTrend rows={filtered.map((s) => ({ date: s.saleDate, amount: s.total }))} />
          </article>
          {filtered.map((sale) => {
            const st = STATUS[sale.status];
            return (
              <article key={sale.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-subtle">{sale.invoiceNumber}</p>
                    <h2 className="text-base font-medium">{sale.customerName}</h2>
                    <p className="text-xs text-muted">{formatDate(sale.saleDate)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-base font-medium tabular-nums">{formatEgp(sale.total)}</p>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {sale.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-3">
                      <span className="text-muted">
                        {it.productName} × {formatQty(it.qty)}
                      </span>
                      <span className="tabular-nums">{formatEgp(it.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                {sale.remaining > 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    المتبقي {formatEgp(sale.remaining)} — المحصّل {formatEgp(sale.collected)}
                  </p>
                ) : null}
                {canEdit ? (
                  <div className="mt-2 flex items-center justify-end gap-1">
                    {sale.remaining > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={collect.isPending}
                        onClick={() => collect.mutate(sale)}
                      >
                        تحصيل المتبقي
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      className="grid size-11 place-items-center text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm("حذف الفاتورة وإرجاع الكميات للمخزون؟")) del.mutate(sale.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? <SaleForm onClose={() => setOpen(false)} /> : null}
      </Dialog>
    </div>
  );
}

type Line = { productId: string; qty: number; unitPrice: number };

function SaleForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), ...LIVE });
  const products = productsQ.data ?? [];
  const [customerName, setCustomerName] = useState("");
  const [saleDate, setSaleDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1, unitPrice: 0 }]);
  const [collectNow, setCollectNow] = useState(0);
  const [collectMethod, setCollectMethod] = useState("نقدي");

  const total = roundMoney(lines.reduce((s, l) => s + (l.qty > 0 ? l.qty * l.unitPrice : 0), 0));

  function pickProduct(index: number, id: string) {
    const p = products.find((x) => x.id === id);
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, productId: id, unitPrice: p?.salePrice ?? l.unitPrice } : l,
      ),
    );
  }

  const save = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          customerName,
          saleDate,
          notes,
          items: lines,
          collectNow,
          collectMethod,
        },
      }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء ${res.invoiceNumber}`);
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <DialogContent title="فاتورة بيع" className="w-[min(100%-1.5rem,36rem)]">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="العميل">
            <Input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">الأصناف</p>
          {lines.map((line, i) => (
            <LineRow
              key={i}
              line={line}
              products={products}
              onProduct={(id) => pickProduct(i, id)}
              onChange={(next) => setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)))}
              onRemove={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              canRemove={lines.length > 1}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines((p) => [...p, { productId: "", qty: 1, unitPrice: 0 }])}
          >
            + صنف
          </Button>
        </div>

        <p className="text-end text-sm font-medium tabular-nums">الإجمالي {formatEgp(total)}</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="تحصيل الآن">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={collectNow}
              onChange={(e) => setCollectNow(Number(e.target.value))}
            />
          </Field>
          <Field label="طريقة التحصيل">
            <Select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        {total > 0 ? (
          <button
            type="button"
            className="text-start text-xs text-muted hover:text-ink"
            onClick={() => setCollectNow(total)}
          >
            تحصيل كامل {formatEgp(total)}
          </button>
        ) : null}
        <Field label="ملاحظات">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ الفاتورة"}
        </Button>
      </form>
    </DialogContent>
  );
}

function LineRow({
  line,
  products,
  onProduct,
  onChange,
  onRemove,
  canRemove,
}: {
  line: Line;
  products: Product[];
  onProduct: (id: string) => void;
  onChange: (line: Line) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const p = products.find((x) => x.id === line.productId);
  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-12 sm:col-span-5">
        <Select value={line.productId} onChange={(e) => onProduct(e.target.value)} required>
          <option value="">اختر منتجاً</option>
          {products.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name} ({formatQty(prod.stockQty)})
            </option>
          ))}
        </Select>
      </div>
      <div className="col-span-4 sm:col-span-2">
        <Input
          type="number"
          min={0.001}
          step="0.001"
          value={line.qty}
          onChange={(e) => onChange({ ...line, qty: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-5 sm:col-span-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={line.unitPrice}
          onChange={(e) => onChange({ ...line, unitPrice: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-3 flex items-center justify-between sm:col-span-2">
        <span className="text-xs tabular-nums text-muted">{formatEgp(roundMoney(line.qty * line.unitPrice))}</span>
        {canRemove ? (
          <button type="button" className="size-11 text-muted hover:text-danger" onClick={onRemove}>
            <Trash2 className="mx-auto size-4" />
          </button>
        ) : null}
      </div>
      {p && line.qty > p.stockQty ? (
        <p className="col-span-12 text-xs text-danger">المتاح {formatQty(p.stockQty)}</p>
      ) : null}
    </div>
  );
}
