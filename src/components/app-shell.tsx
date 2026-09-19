import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCanEdit, useCompany } from "@/components/company-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/products", label: "المنتجات", icon: Package },
  { to: "/sales", label: "المبيعات", icon: ShoppingCart },
  { to: "/purchases", label: "المشتريات", icon: Truck },
  { to: "/collections", label: "التحصيلات", icon: Banknote },
  { to: "/expenses", label: "المصاريف", icon: Receipt },
  { to: "/team", label: "الفريق", icon: Users },
] as const;

const MOBILE_PRIMARY = ["/", "/sales", "/purchases", "/collections"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const company = useCompany();
  const canEdit = useCanEdit();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <aside className="fixed inset-y-0 start-0 hidden w-60 border-e border-line bg-surface md:flex md:flex-col">
        <div className="px-5 py-6">
          <p className="text-[10px] font-medium tracking-[0.32em] text-muted">MONO CHROME</p>
          <p className="mt-2 text-sm font-medium leading-snug">{company.name}</p>
          <div className="mt-3">
            <Badge tone={canEdit ? "solid" : "muted"}>{canEdit ? "مدير" : "مشاهد"}</Badge>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                  active ? "bg-ink text-accent-fg" : "text-muted hover:bg-ink/5 hover:text-ink",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <UserButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-sm md:hidden">
        <div>
          <p className="text-[10px] font-medium tracking-[0.28em] text-muted">MONO CHROME</p>
          <p className="text-sm font-medium">{company.name}</p>
        </div>
        <UserButton />
      </header>

      <main className="px-4 pb-28 pt-4 md:ps-60 md:pe-8 md:pb-10 md:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => (MOBILE_PRIMARY as readonly string[]).includes(n.to)).map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                  active ? "text-ink" : "text-muted",
                )}
              >
                <Icon className="size-4" strokeWidth={active ? 2.2 : 1.75} />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
              ["/products", "/expenses", "/team"].some((p) => pathname.startsWith(p))
                ? "text-ink"
                : "text-muted",
            )}
          >
            <MoreHorizontal className="size-4" />
            المزيد
          </button>
        </div>
        {moreOpen ? (
          <div className="border-t border-line px-3 py-2">
            {NAV.filter((n) => !((MOBILE_PRIMARY as readonly string[]).includes(n.to))).map(
              (item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-md px-2 text-sm hover:bg-ink/5"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ),
            )}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
