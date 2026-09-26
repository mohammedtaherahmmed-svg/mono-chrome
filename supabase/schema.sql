-- Mono Chrome schema v2
-- Open this file and paste it into Supabase SQL Editor, then Run.
-- Do not copy from chat (symbols get corrupted).

create extension if not exists pgcrypto;
create schema if not exists private;

drop table if exists expenses cascade;
drop table if exists collections cascade;
drop table if exists purchase_items cascade;
drop table if exists sale_items cascade;
drop table if exists purchases cascade;
drop table if exists sales cascade;
drop table if exists products cascade;
drop table if exists company_members cascade;
drop table if exists companies cascade;

drop function if exists public.my_company_ids();
drop function if exists public.is_manager(text);
drop function if exists public.create_company(text, text);
drop function if exists public.join_company(text, text);
drop function if exists public.rotate_invite();
drop function if exists private.my_company_ids();
drop function if exists private.is_manager(uuid);
drop function if exists private.set_created_by();
drop function if exists private.new_invite_code();

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint companies_invite_code_key unique (invite_code),
  constraint companies_invite_code_len check (char_length(invite_code) >= 10)
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager', 'viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  constraint company_members_user_id_key unique (user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sku text,
  unit text not null default 'قطعة',
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  stock_qty numeric(14,3) not null default 0 check (stock_qty >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  customer_name text not null,
  sale_date date not null,
  total numeric(14,2) not null default 0 check (total >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint sales_invoice_unique unique (company_id, invoice_number)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  supplier_name text not null,
  purchase_date date not null,
  total numeric(14,2) not null default 0 check (total >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint purchases_invoice_unique unique (company_id, invoice_number)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete restrict,
  customer_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  collected_at date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index company_members_company_role_idx
  on public.company_members (company_id, user_id, role);
create index products_company_id_idx on public.products (company_id);
create index sales_company_date_idx on public.sales (company_id, sale_date);
create index purchases_company_date_idx on public.purchases (company_id, purchase_date);
create index expenses_company_date_idx on public.expenses (company_id, expense_date);
create index collections_company_date_idx on public.collections (company_id, collected_at);
create index collections_sale_id_idx on public.collections (sale_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index purchase_items_purchase_id_idx on public.purchase_items (purchase_id);

create or replace function private.my_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.company_id
  from public.company_members m
  where m.user_id = (select auth.uid());
$fn$;

create or replace function private.is_manager(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = cid
      and m.user_id = (select auth.uid())
      and m.role = 'manager'
  );
$fn$;

create or replace function private.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  new.created_by := (select auth.uid());
  if new.created_by is null then
    raise exception 'Unauthorized';
  end if;
  return new;
end;
$fn$;

create or replace function private.new_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (
      select 1 from public.companies c where c.invite_code = v_code
    );
  end loop;
  return v_code;
end;
$fn$;

create trigger products_created_by before insert on public.products
  for each row execute procedure private.set_created_by();
create trigger sales_created_by before insert on public.sales
  for each row execute procedure private.set_created_by();
create trigger purchases_created_by before insert on public.purchases
  for each row execute procedure private.set_created_by();
create trigger collections_created_by before insert on public.collections
  for each row execute procedure private.set_created_by();
create trigger expenses_created_by before insert on public.expenses
  for each row execute procedure private.set_created_by();
create trigger companies_created_by before insert on public.companies
  for each row execute procedure private.set_created_by();

create or replace function public.create_company(p_name text, p_display text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  v_code text;
  v_name text := coalesce(nullif(trim(p_name), ''), 'Mono Chrome');
  v_display text := coalesce(nullif(trim(p_display), ''), 'مدير');
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  if exists (select 1 from public.company_members m where m.user_id = v_uid) then
    raise exception 'already a member';
  end if;
  v_code := private.new_invite_code();
  begin
    insert into public.companies (id, name, invite_code, created_by)
      values (v_id, v_name, v_code, v_uid);
  exception when unique_violation then
    v_code := private.new_invite_code();
    insert into public.companies (id, name, invite_code, created_by)
      values (v_id, v_name, v_code, v_uid);
  end;
  insert into public.company_members (company_id, user_id, role, display_name)
    values (v_id, v_uid, 'manager', v_display);
  return jsonb_build_object(
    'id', v_id, 'name', v_name, 'inviteCode', v_code, 'role', 'manager'
  );
end;
$fn$;

create or replace function public.join_company(p_code text, p_display text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_display text := coalesce(nullif(trim(p_display), ''), 'عضو');
  v_co public.companies%rowtype;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  if exists (select 1 from public.company_members m where m.user_id = v_uid) then
    raise exception 'already a member';
  end if;
  select * into v_co
  from public.companies c
  where c.invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid invite code'; end if;
  insert into public.company_members (company_id, user_id, role, display_name)
    values (v_co.id, v_uid, 'viewer', v_display);
  return jsonb_build_object(
    'id', v_co.id, 'name', v_co.name, 'inviteCode', v_co.invite_code, 'role', 'viewer'
  );
end;
$fn$;

create or replace function public.rotate_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_cid uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  select m.company_id into v_cid
  from public.company_members m
  where m.user_id = v_uid and m.role = 'manager';
  if v_cid is null then raise exception 'Unauthorized'; end if;
  v_code := private.new_invite_code();
  update public.companies c set invite_code = v_code where c.id = v_cid;
  return jsonb_build_object('inviteCode', v_code);
end;
$fn$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.collections enable row level security;
alter table public.expenses enable row level security;

create policy companies_select on public.companies
  for select to authenticated
  using (id in (select private.my_company_ids()));
create policy companies_update on public.companies
  for update to authenticated
  using (private.is_manager(id))
  with check (private.is_manager(id));

create policy members_select on public.company_members
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy members_update on public.company_members
  for update to authenticated
  using (private.is_manager(company_id))
  with check (private.is_manager(company_id));

create policy products_select on public.products
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy products_insert on public.products
  for insert to authenticated
  with check (private.is_manager(company_id));
create policy products_update on public.products
  for update to authenticated
  using (private.is_manager(company_id))
  with check (private.is_manager(company_id));
create policy products_delete on public.products
  for delete to authenticated
  using (private.is_manager(company_id));

create policy sales_select on public.sales
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy sales_insert on public.sales
  for insert to authenticated
  with check (private.is_manager(company_id));
create policy sales_delete on public.sales
  for delete to authenticated
  using (private.is_manager(company_id));

create policy sale_items_select on public.sale_items
  for select to authenticated
  using (sale_id in (
    select s.id from public.sales s where s.company_id in (select private.my_company_ids())
  ));
create policy sale_items_insert on public.sale_items
  for insert to authenticated
  with check (sale_id in (
    select s.id from public.sales s where private.is_manager(s.company_id)
  ));
create policy sale_items_delete on public.sale_items
  for delete to authenticated
  using (sale_id in (
    select s.id from public.sales s where private.is_manager(s.company_id)
  ));

create policy purchases_select on public.purchases
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy purchases_insert on public.purchases
  for insert to authenticated
  with check (private.is_manager(company_id));
create policy purchases_update on public.purchases
  for update to authenticated
  using (private.is_manager(company_id))
  with check (private.is_manager(company_id));
create policy purchases_delete on public.purchases
  for delete to authenticated
  using (private.is_manager(company_id));

create policy purchase_items_select on public.purchase_items
  for select to authenticated
  using (purchase_id in (
    select p.id from public.purchases p where p.company_id in (select private.my_company_ids())
  ));
create policy purchase_items_insert on public.purchase_items
  for insert to authenticated
  with check (purchase_id in (
    select p.id from public.purchases p where private.is_manager(p.company_id)
  ));
create policy purchase_items_delete on public.purchase_items
  for delete to authenticated
  using (purchase_id in (
    select p.id from public.purchases p where private.is_manager(p.company_id)
  ));

create policy collections_select on public.collections
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy collections_insert on public.collections
  for insert to authenticated
  with check (private.is_manager(company_id));
create policy collections_delete on public.collections
  for delete to authenticated
  using (private.is_manager(company_id));

create policy expenses_select on public.expenses
  for select to authenticated
  using (company_id in (select private.my_company_ids()));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (private.is_manager(company_id));
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (private.is_manager(company_id));

revoke all on schema public from public;
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

revoke all on all tables in schema public from public, anon;
grant select, insert, update, delete on
  public.products, public.sales, public.sale_items,
  public.purchases, public.purchase_items,
  public.collections, public.expenses
  to authenticated;
grant select, update on public.companies to authenticated;
grant select, update on public.company_members to authenticated;

revoke all on function private.my_company_ids() from public, anon;
revoke all on function private.is_manager(uuid) from public, anon;
revoke all on function private.set_created_by() from public, anon;
revoke all on function private.new_invite_code() from public, anon;
revoke all on function public.create_company(text, text) from public, anon;
revoke all on function public.join_company(text, text) from public, anon;
revoke all on function public.rotate_invite() from public, anon;

grant execute on function private.my_company_ids() to authenticated;
grant execute on function private.is_manager(uuid) to authenticated;
grant execute on function public.create_company(text, text) to authenticated;
grant execute on function public.join_company(text, text) to authenticated;
grant execute on function public.rotate_invite() to authenticated;
