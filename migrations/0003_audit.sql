-- Central audit trail for manager-controlled changes.
create table if not exists audit_events (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  actor_user_id text not null,
  action text not null check (action in ('create', 'update', 'delete', 'role_change', 'invite_rotate', 'join')),
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_company_created_idx
  on audit_events (company_id, created_at desc);
create index if not exists audit_events_actor_idx
  on audit_events (actor_user_id, created_at desc);
