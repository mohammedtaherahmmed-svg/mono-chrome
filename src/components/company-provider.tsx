import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { getMyCompany, type CompanyInfo } from "@/lib/server/company";
import { LIVE } from "@/lib/query";

const CompanyContext = createContext<CompanyInfo | null>(null);

export function CompanyProvider({
  company,
  children,
}: {
  company: CompanyInfo;
  children: ReactNode;
}) {
  return <CompanyContext.Provider value={company}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyInfo {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

export function useCanEdit(): boolean {
  return useCompany().role === "manager";
}

export function useCompanyQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["company"],
    queryFn: () => getMyCompany(),
    enabled,
    ...LIVE,
  });
}
