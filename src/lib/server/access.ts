import { getSql, type Sql } from "@/lib/db";

export type MemberRole = "manager" | "viewer";

export type MemberCtx = {
  sql: Sql;
  userId: string;
  companyId: string;
  role: MemberRole;
  companyName: string;
  inviteCode: string;
};

export async function findMembership(userId: string): Promise<MemberCtx | null> {
  const sql = await getSql();
  const rows = await sql<{
    company_id: string;
    role: MemberRole;
    company_name: string;
    invite_code: string;
  }>`
    select
      m.company_id,
      m.role,
      c.name as company_name,
      c.invite_code
    from company_members m
    join companies c on c.id = m.company_id
    where m.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    sql,
    userId,
    companyId: row.company_id,
    role: row.role,
    companyName: row.company_name,
    inviteCode: row.invite_code,
  };
}

export async function requireMember(userId: string): Promise<MemberCtx> {
  const ctx = await findMembership(userId);
  if (!ctx) throw new Error("NO_COMPANY");
  return ctx;
}

export async function requireManager(userId: string): Promise<MemberCtx> {
  const ctx = await requireMember(userId);
  if (ctx.role !== "manager") throw new Error("المدير فقط يمكنه التعديل");
  return ctx;
}
