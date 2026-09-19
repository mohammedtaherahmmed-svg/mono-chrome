-- Mono Chrome company ledger
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
create index if not exists company_members_company_id_idx on company_members (company_id);

create table if not exists products (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  unit text not null default 'قطعة',
  cost_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  stock_qty numeric(14,3) not null default 0,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_company_id_idx on products (company_id);

create table if not exists sales (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  invoice_number text not null,
  customer_name text not null,
  sale_date date not null,
  total numeric(14,2) not null default 0,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists sales_company_id_idx on sales (company_id);
create index if not exists sales_date_idx on sales (company_id, sale_date);

create table if not exists sale_items (
  id text primary key,
  sale_id text not null references sales(id) on delete cascade,
  product_id text references products(id) on delete set null,
  product_name text not null,
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);
create index if not exists sale_items_sale_id_idx on sale_items (sale_id);

create table if not exists purchases (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  invoice_number text not null,
  supplier_name text not null,
  purchase_date date not null,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists purchases_company_id_idx on purchases (company_id);
create index if not exists purchases_date_idx on purchases (company_id, purchase_date);

create table if not exists purchase_items (
  id text primary key,
  purchase_id text not null references purchases(id) on delete cascade,
  product_id text references products(id) on delete set null,
  product_name text not null,
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  line_total numeric(14,2) not null
);
create index if not exists purchase_items_purchase_id_idx on purchase_items (purchase_id);

create table if not exists collections (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  sale_id text references sales(id) on delete restrict,
  customer_name text not null,
  amount numeric(14,2) not null,
  collected_at date not null,
  method text not null default 'نقدي',
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists collections_company_id_idx on collections (company_id);
create index if not exists collections_date_idx on collections (company_id, collected_at);
create index if not exists collections_sale_id_idx on collections (sale_id);

create table if not exists expenses (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  category text not null,
  amount numeric(14,2) not null,
  expense_date date not null,
  description text,
  payment_method text not null default 'نقدي',
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_company_id_idx on expenses (company_id);
create index if not exists expenses_date_idx on expenses (company_id, expense_date);
