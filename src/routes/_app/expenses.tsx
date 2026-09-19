import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCanEdit } from "@/components/company-provider";
import { AmountTrend, ExpensePie } from "@/components/ledger-charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { errMessage } from "@/lib/errors";
import { formatDate, formatEgp, todayIso } from "@/lib/format";
import { LIVE } from "@/lib/query";
import { createExpense, deleteExpense, listExpenses } from "@/lib/server/expenses";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["expenses"], queryFn: () => listExpenses(), ...LIVE });
  const [open, setOpen] = useState(false);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of q.data ?? []) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [q.data]);

  const total = useMemo(
    () => (q.data ?? []).reduce((s, e) => s + e.amount, 0),
    [q.data],
  );

  const del = useMutation({
    mutationFn: (id: string) => deleteExpense({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المصروف");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="الصندوق"
        title="المصاريف"
        action={
          canEdit ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              مصروف
            </Button>
          ) : null
        }
      />
      <p className="mb-4 text-sm text-muted">
        الإجمالي المسجّل <span className="font-medium tabular-nums text-ink">{formatEgp(total)}</span>
      </p>
      {q.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          title="لا مصاريف"
          hint="كل مصروف يخرج من الصندوق مباشرة ويظهر في الرسم والصافي عند الجميع."
          action={canEdit ? <Button onClick={() => setOpen(true)}>تسجيل مصروف</Button> : null}
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-medium">خروج المصاريف</h2>
              <AmountTrend rows={(q.data ?? []).map((e) => ({ date: e.expenseDate, amount: e.amount }))} />
            </article>
            <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="text-sm font-medium">حسب التصنيف</h2>
              <ExpensePie rows={byCategory} />
            </article>
          </div>
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-line">
            {(q.data ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{e.category}</p>
                  <p className="text-xs text-muted">
                    {formatDate(e.expenseDate)} · {e.paymentMethod}
                    {e.description ? ` · ${e.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums text-sm font-medium">{formatEgp(e.amount)}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="grid size-11 place-items-center text-muted hover:text-danger"
                      onClick={() => {
                        if (confirm("حذف هذا المصروف؟")) del.mutate(e.id);
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
        {open ? <ExpenseForm onClose={() => setOpen(false)} /> : null}
      </Dialog>
    </div>
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState(0);
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");

  const save = useMutation({
    mutationFn: () =>
      createExpense({
        data: { category, amount, expenseDate, description, paymentMethod },
      }),
    onSuccess: () => {
      toast.success("تم تسجيل المصروف");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <DialogContent title="مصروف جديد">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="التصنيف">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
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
            <Input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </Field>
        </div>
        <Field label="طريقة الدفع">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="الوصف">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </form>
    </DialogContent>
  );
}
