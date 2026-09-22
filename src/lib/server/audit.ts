import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { requireMember } from "./access";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "role_change"
  | "invite_rotate"
  | "join";

export async function recordAudit(
  sql: Sql,
  event: {
    companyId: string;
    actorUserId: string;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  const id = nid();
  await sql`
    insert into audit_events (
      id, company_id, actor_user_id, action, entity, entity_id, details
    ) values (
      ${id}, ${event.companyId}, ${event.actorUserId}, ${event.action},
      ${event.entity}, ${event.entityId ?? null}, ${JSON.stringify(event.details ?? {})}::jsonb
    )
  `;
}

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, companyId } = await requireMember(context.userId);
    const rows = await sql<{
      id: string;
      actor_user_id: string;
      action: AuditAction;
      entity: string;
      entity_id: string | null;
      details: string;
      created_at: string;
    }>`
      select id, actor_user_id, action, entity, entity_id, details::text as details,
             created_at::text as created_at
      from audit_events
      where company_id = ${companyId}
      order by created_at desc
      limit 100
    `;
    return rows;
  });
