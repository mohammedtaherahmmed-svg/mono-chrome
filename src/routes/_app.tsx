import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CompanyProvider, useCompanyQuery } from "@/components/company-provider";
import { Onboarding } from "@/components/onboarding";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const companyQ = useCompanyQuery(Boolean(user));

  if (isPending) return <BootSkeleton />;
  if (!user) return <RedirectToSignIn />;
  if (companyQ.isPending) return <BootSkeleton />;
  if (companyQ.error) {
    const msg = companyQ.error instanceof Error ? companyQ.error.message : "";
    if (msg === "Unauthorized") return <RedirectToSignIn />;
  }
  if (!companyQ.data) return <Onboarding />;

  return (
    <CompanyProvider company={companyQ.data}>
      <AppShell>
        <Outlet />
      </AppShell>
    </CompanyProvider>
  );
}

function BootSkeleton() {
  return (
    <div className="min-h-dvh bg-bg px-6 py-10">
      <p className="text-[11px] font-medium tracking-[0.32em] text-muted">MONO CHROME</p>
      <p className="mt-3 text-2xl font-medium">جاري التحميل</p>
      <Skeleton className="mt-8 h-4 w-28" />
      <Skeleton className="mt-4 h-10 w-56" />
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}
