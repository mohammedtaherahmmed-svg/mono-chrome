import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCanEdit } from "@/components/company-provider";
import { AmountTrend } from "@/components/ledger-charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/lib/errors";
import { formatDate, formatEgp, formatQty, todayIso } from "@/lib/format";
import { LIVE } from "@/lib/query";
import { listProducts, type Product } from "@/lib/server/products";
import {
  createPurchase,
  deletePurchase,
  listPurchases,
  updatePurchasePaid,
} from "@/lib/server/purchases";
import { roundMoney } from "@/lib/utils";

export const Route = createFileRoute("/_app/purchases")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["purchases"], queryFn: () => listPurchases(), ...LIVE });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => deletePurchase({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف فاتورة الشراء وخصم المخزون");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const pay = useMutation({
    mutationFn: (d: { id: string; paidAmount: number }) => updatePurchasePaid({ data: d }),
    onSuccess: () => {
      toast.success("تم تحديث السداد");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="الموردون"
        title="المشتريات"
        action={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              فاتورة شراء
            </Button>
          ) : null
        }
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          title="لا مشتريات بعد"
          hint="الشراء يزيد المخزون. المبلغ المدفوع هنا يخصم من الصندوق."
          action={canEdit ? <Button onClick={() => setOpen(true)}>أول فاتورة شراء</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-medium">حركة المشتريات</h2>
            <p className="mb-2 text-xs text-muted">قيمة الفواتير حسب التاريخ</p>
            <AmountTrend rows={(q.data ?? []).map((p) => ({ date: p.purchaseDate, amount: p.total }))} />
          </article>
          {(q.data ?? []).map((p) => (
            <article key={p.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-subtle">{p.invoiceNumber}</p>
                  <h2 className="text-base font-medium">{p.supplierName}</h2>
                  <p className="text-xs text-muted">{formatDate(p.purchaseDate)}</p>
                </div>
                <p className="text-base font-medium tabular-nums">{formatEgp(p.total)}</p>
              </div>
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                {p.items.map((it) => (
                  <li key={it.id} className="flex justify-between">
                    <span className="text-muted">
                      {it.productName} × {formatQty(it.qty)}
                    </span>
                    <span className="tabular-nums">{formatEgp(it.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                المدفوع {formatEgp(p.paidAmount)}
                {p.remaining > 0 ? ` — المتبقي ${formatEgp(p.remaining)}` : " — مسددة"}
              </p>
              {canEdit ? (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {p.remaining > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pay.mutate({ id: p.id, paidAmount: p.total })}
                    >
                      سداد كامل
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="grid size-11 place-items-center text-muted hover:text-danger"
                    onClick={() => {
                      if (confirm("حذف الفاتورة وخصم الكميات من المخزون؟")) del.mutate(p.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? <PurchaseForm onClose={() => setOpen(false)} /> : null}
      </Dialog>
    </div>
  );
}

type Line = { productId: string; qty: number; unitCost: number };

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), ...LIVE });
  const products = productsQ.data ?? [];
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [paidManual, setPaidManual] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: 1, unitCost: 0 }]);
  const total = roundMoney(lines.reduce((s, l) => s + l.qty * l.unitCost, 0));
  const paidAmount = paidManual === null ? total : paidManual;

  function pick(i: number, id: string) {
    const p = products.find((x) => x.id === id);
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, productId: id, unitCost: p?.costPrice ?? l.unitCost } : l)),
    );
  }

  const save = useMutation({
    mutationFn: () =>
      createPurchase({
        data: { supplierName, purchaseDate, notes, paidAmount, items: lines },
      }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء ${res.invoiceNumber}`);
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <DialogContent title="فاتورة شراء" className="w-[min(100%-1.5rem,36rem)]">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="المورد">
            <Input required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </Field>
          <Field label="التاريخ">
            <Input type="date" required value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-6">
                <Select value={line.productId} required onChange={(e) => pick(i, e.target.value)}>
                  <option value="">المنتج</option>
                  {products.map((p: Product) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: Number(e.target.value) } : l)))
                  }
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, idx) => (idx === i ? { ...l, unitCost: Number(e.target.value) } : l)),
                    )
                  }
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="size-11 text-muted"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="mx-auto size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines((p) => [...p, { productId: "", qty: 1, unitCost: 0 }])}
          >
            + صنف
          </Button>
        </div>
        <p className="text-end text-sm font-medium tabular-nums">الإجمالي {formatEgp(total)}</p>
        <Field label="المدفوع الآن (من الصندوق)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidManual(Number(e.target.value))}
          />
        </Field>
        {total > 0 ? (
          <button
            type="button"
            className="text-start text-xs text-muted hover:text-ink"
            onClick={() => setPaidManual(total)}
          >
            سداد كامل {formatEgp(total)}
          </button>
        ) : null}
        <Field label="ملاحظات">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </form>
    </DialogContent>
  );
}
