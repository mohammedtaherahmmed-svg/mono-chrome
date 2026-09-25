-- Mono Chrome schema. Copy from this file, not from chat.
create extension if not exists pgcrypto;

create table if not exists companies (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists company_members (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  user_id text not null unique,
  role text not null check (role in ('manager', 'viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists products (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  sku text,
  unit text not null default 'قطعة',
  cost_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  stock_qty numeric(14,3) not null default 0,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  invoice_number text not null,
  customer_name text not null,
  sale_date date not null,
  total numeric(14,2) not null default 0,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  product_id text,
  product_name text not null,
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null
);

create table if not exists purchases (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  invoice_number text not null,
  supplier_name text not null,
  purchase_date date not null,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id text primary key,
  purchase_id text not null references purchases(id) on delete cascade,
  product_id text,
  product_name text not null,
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null
);

create table if not exists collections (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  sale_id text,
  customer_name text not null,
  amount numeric(14,2) not null,
  collected_at date not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  category text not null,
  amount numeric(14,2) not null,
  expense_date date not null,
  description text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create or replace function my_company_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as '
  select company_id from company_members where user_id = auth.uid()::text;
';

create or replace function is_manager(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as '
  select exists (
    select 1 from company_members
    where company_id = cid and user_id = auth.uid()::text and role = ''manager''
  );
';

create or replace function create_company(p_name text, p_display text)
returns jsonb
language plpgsql
security definer
set search_path = public
as '
declare
  v_uid text := auth.uid()::text;
  v_id text := gen_random_uuid()::text;
  v_code text;
  v_name text := coalesce(nullif(trim(p_name), ''''), ''Mono Chrome'');
  v_display text := coalesce(nullif(trim(p_display), ''''), ''manager'');
begin
  if v_uid is null then raise exception ''Unauthorized''; end if;
  if exists (select 1 from company_members where user_id = v_uid) then
    raise exception ''already a member'';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, ''-'', ''''), 1, 6));
    exit when not exists (select 1 from companies where invite_code = v_code);
  end loop;
  insert into companies (id, name, invite_code, created_by)
    values (v_id, v_name, v_code, v_uid);
  insert into company_members (id, company_id, user_id, role, display_name)
    values (gen_random_uuid()::text, v_id, v_uid, ''manager'', v_display);
  return jsonb_build_object(
    ''id'', v_id, ''name'', v_name, ''inviteCode'', v_code, ''role'', ''manager''
  );
end;
';

create or replace function join_company(p_code text, p_display text)
returns jsonb
language plpgsql
security definer
set search_path = public
as '
declare
  v_uid text := auth.uid()::text;
  v_display text := coalesce(nullif(trim(p_display), ''''), ''member'');
  v_co companies%rowtype;
begin
  if v_uid is null then raise exception ''Unauthorized''; end if;
  if exists (select 1 from company_members where user_id = v_uid) then
    raise exception ''already a member'';
  end if;
  select * into v_co from companies where invite_code = upper(trim(p_code));
  if not found then raise exception ''invalid invite code''; end if;
  insert into company_members (id, company_id, user_id, role, display_name)
    values (gen_random_uuid()::text, v_co.id, v_uid, ''viewer'', v_display);
  return jsonb_build_object(
    ''id'', v_co.id, ''name'', v_co.name, ''inviteCode'', v_co.invite_code, ''role'', ''viewer''
  );
end;
';

drop policy if exists companies_select on companies;
drop policy if exists companies_update on companies;
drop policy if exists members_select on company_members;
drop policy if exists members_update on company_members;
drop policy if exists products_all on products;
drop policy if exists products_select on products;
drop policy if exists products_write on products;
drop policy if exists products_update on products;
drop policy if exists products_delete on products;
drop policy if exists sales_select on sales;
drop policy if exists sales_write on sales;
drop policy if exists sales_delete on sales;
drop policy if exists sale_items_select on sale_items;
drop policy if exists sale_items_write on sale_items;
drop policy if exists sale_items_delete on sale_items;
drop policy if exists purchases_select on purchases;
drop policy if exists purchases_write on purchases;
drop policy if exists purchases_update on purchases;
drop policy if exists purchases_delete on purchases;
drop policy if exists purchase_items_select on purchase_items;
drop policy if exists purchase_items_write on purchase_items;
drop policy if exists purchase_items_delete on purchase_items;
drop policy if exists collections_select on collections;
drop policy if exists collections_write on collections;
drop policy if exists collections_delete on collections;
drop policy if exists expenses_select on expenses;
drop policy if exists expenses_write on expenses;
drop policy if exists expenses_delete on expenses;

alter table companies enable row level security;
alter table company_members enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table collections enable row level security;
alter table expenses enable row level security;

create policy companies_select on companies for select using (id in (select my_company_ids()));
create policy members_select on company_members for select using (company_id in (select my_company_ids()));
create policy members_update on company_members for update using (is_manager(company_id));
create policy products_select on products for select using (company_id in (select my_company_ids()));
create policy products_write on products for insert with check (is_manager(company_id));
create policy products_update on products for update using (is_manager(company_id));
create policy products_delete on products for delete using (is_manager(company_id));
create policy sales_select on sales for select using (company_id in (select my_company_ids()));
create policy sales_write on sales for insert with check (is_manager(company_id));
create policy sales_delete on sales for delete using (is_manager(company_id));
create policy sale_items_select on sale_items for select using (
  sale_id in (select id from sales where company_id in (select my_company_ids()))
);
create policy sale_items_write on sale_items for insert with check (
  sale_id in (select id from sales where is_manager(company_id))
);
create policy sale_items_delete on sale_items for delete using (
  sale_id in (select id from sales where is_manager(company_id))
);
create policy purchases_select on purchases for select using (company_id in (select my_company_ids()));
create policy purchases_write on purchases for insert with check (is_manager(company_id));
create policy purchases_update on purchases for update using (is_manager(company_id));
create policy purchases_delete on purchases for delete using (is_manager(company_id));
create policy purchase_items_select on purchase_items for select using (
  purchase_id in (select id from purchases where company_id in (select my_company_ids()))
);
create policy purchase_items_write on purchase_items for insert with check (
  purchase_id in (select id from purchases where is_manager(company_id))
);
create policy purchase_items_delete on purchase_items for delete using (
  purchase_id in (select id from purchases where is_manager(company_id))
);
create policy collections_select on collections for select using (company_id in (select my_company_ids()));
create policy collections_write on collections for insert with check (is_manager(company_id));
create policy collections_delete on collections for delete using (is_manager(company_id));
create policy expenses_select on expenses for select using (company_id in (select my_company_ids()));
create policy expenses_write on expenses for insert with check (is_manager(company_id));
create policy expenses_delete on expenses for delete using (is_manager(company_id));
create policy companies_update on companies for update using (is_manager(id));

grant usage on schema public to anon, authenticated;
grant execute on function create_company(text, text) to authenticated;
grant execute on function join_company(text, text) to authenticated;
grant execute on function my_company_ids() to authenticated;
grant execute on function is_manager(text) to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
