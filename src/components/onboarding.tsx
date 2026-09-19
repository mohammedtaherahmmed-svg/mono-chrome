import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";
import { createCompany, joinCompany } from "@/lib/server/company";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function Onboarding() {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const displayName = user?.displayName ?? user?.primaryEmail ?? "";
  const [name, setName] = useState(APP_NAME);
  const [code, setCode] = useState("");

  const create = useMutation({
    mutationFn: () => createCompany({ data: { name, displayName } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: () => joinCompany({ data: { code, displayName } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-3xl flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.28em] text-muted">MONO CHROME</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">دفتر الشركة</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            أنشئ شركة جديدة كمدير، أو ادخل بكود الدعوة كمشاهد. المدير وحده يضيف ويعدّل ويحذف.
          </p>
        </div>
        <UserButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form
          className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <p className="text-xs font-medium text-muted">مدير</p>
          <h2 className="mt-1 text-lg font-medium">إنشاء شركة</h2>
          <div className="mt-5">
            <Field label="اسم الشركة">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <Button type="submit" className="mt-5 w-full" disabled={create.isPending}>
            {create.isPending ? "جاري الإنشاء…" : "إنشاء وبدء العمل"}
          </Button>
        </form>

        <form
          className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate();
          }}
        >
          <p className="text-xs font-medium text-muted">مشاهد</p>
          <h2 className="mt-1 text-lg font-medium">الانضمام بكود</h2>
          <div className="mt-5">
            <Field label="كود الدعوة">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="tracking-[0.3em]"
                required
              />
            </Field>
          </div>
          <Button type="submit" variant="outline" className="mt-5 w-full" disabled={join.isPending}>
            {join.isPending ? "جاري الدخول…" : "انضمام"}
          </Button>
        </form>
      </div>
    </div>
  );
}
