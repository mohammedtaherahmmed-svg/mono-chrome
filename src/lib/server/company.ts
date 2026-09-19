import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { inviteCode, nid } from "@/lib/utils";
import { findMembership, requireManager, requireMember } from "./access";

export type CompanyInfo = {
  id: string;
  name: string;
  inviteCode: string;
  role: "manager" | "viewer";
};

export type MemberRow = {
  id: string;
  userId: string;
  role: "manager" | "viewer";
  displayName: string;
  createdAt: string;
};

export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CompanyInfo | null> => {
    const ctx = await findMembership(context.userId);
    if (!ctx) return null;
    return {
      id: ctx.companyId,
      name: ctx.companyName,
      inviteCode: ctx.inviteCode,
      role: ctx.role,
    };
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; displayName?: string }) => d)
  .handler(async ({ context, data }): Promise<CompanyInfo> => {
    const existing = await findMembership(context.userId);
    if (existing) throw new Error("أنت بالفعل عضو في شركة");
    const name = data.name.trim() || "Mono Chrome";
    const displayName = data.displayName?.trim() || "مدير";
    const sql = await getSql();
    const id = nid();
    const code = inviteCode();
    await sql`
      insert into companies (id, name, invite_code, created_by)
      values (${id}, ${name}, ${code}, ${context.userId})
    `;
    await sql`
      insert into company_members (id, company_id, user_id, role, display_name)
      values (${nid()}, ${id}, ${context.userId}, ${"manager"}, ${displayName})
    `;
    return { id, name, inviteCode: code, role: "manager" };
  });

export const joinCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string; displayName?: string }) => d)
  .handler(async ({ context, data }): Promise<CompanyInfo> => {
    const existing = await findMembership(context.userId);
    if (existing) throw new Error("أنت بالفعل عضو في شركة");
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("أدخل كود الدعوة");
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; invite_code: string }>`
      select id, name, invite_code from companies where invite_code = ${code} limit 1
    `;
    const company = rows[0];
    if (!company) throw new Error("كود الدعوة غير صحيح");
    const displayName = data.displayName?.trim() || "عضو";
    await sql`
      insert into company_members (id, company_id, user_id, role, display_name)
      values (${nid()}, ${company.id}, ${context.userId}, ${"viewer"}, ${displayName})
    `;
    return {
      id: company.id,
      name: company.name,
      inviteCode: company.invite_code,
      role: "viewer",
    };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    const { sql, companyId } = await requireMember(context.userId);
    const rows = await sql<{
      id: string;
      user_id: string;
      role: "manager" | "viewer";
      display_name: string | null;
      created_at: string;
    }>`
      select id, user_id, role, display_name, created_at::text as created_at
      from company_members
      where company_id = ${companyId}
      order by created_at asc
    `;
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      role: r.role,
      displayName: r.display_name ?? r.user_id.slice(0, 8),
      createdAt: r.created_at,
    }));
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { memberId: string; role: "manager" | "viewer" }) => d)
  .handler(async ({ context, data }) => {
    const { sql, companyId } = await requireManager(context.userId);
    if (data.role !== "manager" && data.role !== "viewer") {
      throw new Error("صلاحية غير صالحة");
    }
    if (data.role === "viewer") {
      const managers = await sql<{ c: number }>`
        select count(*)::int as c from company_members
        where company_id = ${companyId} and role = ${"manager"}
      `;
      const target = await sql<{ role: string }>`
        select role from company_members
        where id = ${data.memberId} and company_id = ${companyId}
        limit 1
      `;
      if (target[0]?.role === "manager" && (managers[0]?.c ?? 0) <= 1) {
        throw new Error("لا يمكن إزالة آخر مدير");
      }
    }
    const updated = await sql`
      update company_members
      set role = ${data.role}
      where id = ${data.memberId} and company_id = ${companyId}
      returning id
    `;
    if (!updated[0]) throw new Error("العضو غير موجود");
    return { ok: true as const };
  });

export const rotateInviteCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, companyId } = await requireManager(context.userId);
    const code = inviteCode();
    await sql`update companies set invite_code = ${code} where id = ${companyId}`;
    return { inviteCode: code };
  });
