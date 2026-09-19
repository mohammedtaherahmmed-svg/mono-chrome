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
import { PAYMENT_METHODS } from "@/lib/constants";
import { errMessage } from "@/lib/errors";
import { formatDate, formatEgp, todayIso } from "@/lib/format";
import { LIVE } from "@/lib/query";
import { createCollection, deleteCollection, listCollections } from "@/lib/server/collections";
import { listSales } from "@/lib/server/sales";

export const Route = createFileRoute("/_app/collections")({
  component: CollectionsPage,
});

function CollectionsPage() {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["collections"], queryFn: () => listCollections(), ...LIVE });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => deleteCollection({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف التحصيل");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="الصندوق"
        title="التحصيلات"
        action={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              تحصيل
            </Button>
          ) : null
        }
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          title="لا تحصيلات"
          hint="كل مبلغ يدخل الصندوق يظهر هنا ويُضاف لصافي الصندوق فوراً عند باقي الموظفين."
          action={canEdit ? <Button onClick={() => setOpen(true)}>تسجيل تحصيل</Button> : null}
        />
      ) : (
        <>
          <article className="mb-4 rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-medium">التحصيلات</h2>
                <p className="text-xs text-muted">دخول الصندوق حسب اليوم</p>
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatEgp((q.data ?? []).reduce((s, c) => s + c.amount, 0))}
              </p>
            </div>
            <AmountTrend rows={(q.data ?? []).map((c) => ({ date: c.collectedAt, amount: c.amount }))} />
          </article>
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-line">
            {(q.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{c.customerName}</p>
                  <p className="text-xs text-muted">
                    {formatDate(c.collectedAt)} · {c.method}
                    {c.invoiceNumber ? ` · ${c.invoiceNumber}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums text-sm font-medium">{formatEgp(c.amount)}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="grid size-11 place-items-center text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm("حذف هذا التحصيل من الصندوق؟")) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? <CollectionForm onClose={() => setOpen(false)} /> : null}
      </Dialog>
    </div>
  );
}

function CollectionForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const salesQ = useQuery({ queryKey: ["sales"], queryFn: () => listSales(), ...LIVE });
  const openSales = (salesQ.data ?? []).filter((s) => s.remaining > 0);
  const [saleId, setSaleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState(0);
  const [collectedAt, setCollectedAt] = useState(todayIso());
  const [method, setMethod] = useState("نقدي");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      createCollection({
        data: {
          saleId: saleId || null,
          customerName,
          amount,
          collectedAt,
          method,
          notes,
        },
      }),
    onSuccess: () => {
      toast.success("تم تسجيل التحصيل");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <DialogContent title="تحصيل جديد">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="ربط بفاتورة (اختياري)">
          <Select
            value={saleId}
            onChange={(e) => {
              const id = e.target.value;
              setSaleId(id);
              const s = openSales.find((x) => x.id === id);
              if (s) {
                setCustomerName(s.customerName);
                setAmount(s.remaining);
              }
            }}
          >
            <option value="">بدون فاتورة</option>
            {openSales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.invoiceNumber} — {s.customerName} ({formatEgp(s.remaining)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العميل">
          <Input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ">
            <Input
              type="number"
              min={0.01}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="التاريخ">
            <Input type="date" required value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
          </Field>
        </div>
        <Field label="الطريقة">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
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
