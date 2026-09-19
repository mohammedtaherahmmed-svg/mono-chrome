import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useCanEdit, useCompany } from "@/components/company-provider";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/lib/errors";
import { LIVE } from "@/lib/query";
import { listMembers, rotateInviteCode, setMemberRole } from "@/lib/server/company";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

function TeamPage() {
  const company = useCompany();
  const canEdit = useCanEdit();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["members"], queryFn: () => listMembers(), ...LIVE });

  const rotate = useMutation({
    mutationFn: () => rotateInviteCode(),
    onSuccess: () => {
      toast.success("تم تغيير كود الدعوة");
      void qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const role = useMutation({
    mutationFn: (d: { memberId: string; role: "manager" | "viewer" }) => setMemberRole({ data: d }),
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(company.inviteCode);
      toast.success("تم نسخ الكود");
    } catch {
      toast.error("تعذر النسخ");
    }
  }

  return (
    <div>
      <PageHeader eyebrow="الوصول" title="الفريق" />

      <article className="mb-4 rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs text-muted">كود الدعوة — المشاهد يرى كل شيء ولا يعدّل</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ink px-4 py-2 font-medium tracking-[0.35em] text-accent-fg">
            {company.inviteCode}
          </span>
          <Button variant="outline" size="sm" onClick={() => void copyCode()}>
            <Copy className="size-4" />
            نسخ
          </Button>
          {canEdit ? (
            <Button variant="ghost" size="sm" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              كود جديد
            </Button>
          ) : null}
        </div>
      </article>

      {q.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-line">
            {(q.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{m.displayName}</p>
                  <Badge tone={m.role === "manager" ? "solid" : "muted"}>
                    {m.role === "manager" ? "مدير" : "مشاهد"}
                  </Badge>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={role.isPending}
                    onClick={() =>
                      role.mutate({
                        memberId: m.id,
                        role: m.role === "manager" ? "viewer" : "manager",
                      })
                    }
                  >
                    {m.role === "manager" ? "جعله مشاهداً" : "جعله مديراً"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
