const PAGES = [
  ["home", "الرئيسية"],
  ["products", "المنتجات"],
  ["sales", "المبيعات"],
  ["purchases", "المشتريات"],
  ["more", "المزيد"],
];

const sbUrl = () => (window.MC && window.MC.url ? window.MC.url.replace(/\/$/, "") : "");
const sbAnon = () => (window.MC && window.MC.anon) || "";
const configured = () => Boolean(sbUrl() && sbAnon());

function nid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}
function today() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function money(n) {
  return `${(Number(n) || 0).toLocaleString("en-EG", { maximumFractionDigits: 2 })} ج.م`;
}
function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}
function num(v) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

let token = localStorage.getItem("mc-token") || "";
let userId = localStorage.getItem("mc-uid") || "";
let company = null;
try {
  company = JSON.parse(localStorage.getItem("mc-company") || "null");
} catch {
  company = null;
}

let page = "home";
let period = "month";
let modal = null;
let errMsg = "";
let loading = false;
const db = {
  products: [],
  sales: [],
  saleItems: [],
  purchases: [],
  purchaseItems: [],
  collections: [],
  expenses: [],
  members: [],
};

function canEdit() {
  return company && company.role === "manager";
}

function setCompany(c) {
  company = c;
  if (c) localStorage.setItem("mc-company", JSON.stringify(c));
  else localStorage.removeItem("mc-company");
}

function setSession(t, uid) {
  token = t;
  userId = uid;
  if (t) localStorage.setItem("mc-token", t);
  else localStorage.removeItem("mc-token");
  if (uid) localStorage.setItem("mc-uid", uid);
  else localStorage.removeItem("mc-uid");
}

function deviceCreds() {
  let c = null;
  try {
    c = JSON.parse(localStorage.getItem("mc-creds") || "null");
  } catch {
    c = null;
  }
  if (!c) {
    const id = nid().replace(/-/g, "");
    c = { email: `${id}@mono-chrome.app`, password: `${nid()}Aa1!` };
    localStorage.setItem("mc-creds", JSON.stringify(c));
  }
  return c;
}

async function authFetch(path, body) {
  const res = await fetch(`${sbUrl()}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: sbAnon(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "فشل الدخول");
  return data;
}

async function ensureSession() {
  if (token && userId) return;
  const creds = deviceCreds();
  try {
    const data = await authFetch("token?grant_type=password", {
      email: creds.email,
      password: creds.password,
    });
    setSession(data.access_token, data.user.id);
    return;
  } catch {
    /* try signup */
  }
  const signed = await authFetch("signup", {
    email: creds.email,
    password: creds.password,
  });
  if (signed.access_token && signed.user) {
    setSession(signed.access_token, signed.user.id);
    return;
  }
  const data = await authFetch("token?grant_type=password", {
    email: creds.email,
    password: creds.password,
  });
  setSession(data.access_token, data.user.id);
}

async function rest(path, { method = "GET", body, query } = {}) {
  let url = `${sbUrl()}/rest/v1/${path}`;
  if (query) url += query.startsWith("?") ? query : `?${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: sbAnon(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.hint)) || text || "خطأ في السيرفر";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

async function rpc(name, args) {
  return rest(`rpc/${name}`, { method: "POST", body: args });
}

function inPeriod(iso) {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  const now = new Date();
  const from = new Date(now);
  if (period === "week") from.setDate(now.getDate() - 6);
  else if (period === "month") from.setDate(1);
  else from.setMonth(0, 1);
  const b = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  return d >= b && d <= today();
}

function saleCollected(saleId) {
  return round(db.collections.filter((c) => c.sale_id === saleId).reduce((s, x) => s + num(x.amount), 0));
}
function cashNet() {
  const coll = db.collections.reduce((s, x) => s + num(x.amount), 0);
  const paid = db.purchases.reduce((s, x) => s + num(x.paid_amount), 0);
  const exp = db.expenses.reduce((s, x) => s + num(x.amount), 0);
  return round(coll - paid - exp);
}

async function loadAll() {
  if (!company) return;
  const cid = company.id;
  const [products, sales, saleItems, purchases, purchaseItems, collections, expenses, members] =
    await Promise.all([
      rest("products", { query: `select=*&company_id=eq.${cid}&order=name.asc` }),
      rest("sales", { query: `select=*&company_id=eq.${cid}&order=sale_date.desc` }),
      rest("sale_items", { query: "select=*" }),
      rest("purchases", { query: `select=*&company_id=eq.${cid}&order=purchase_date.desc` }),
      rest("purchase_items", { query: "select=*" }),
      rest("collections", { query: `select=*&company_id=eq.${cid}&order=collected_at.desc` }),
      rest("expenses", { query: `select=*&company_id=eq.${cid}&order=expense_date.desc` }),
      rest("company_members", { query: `select=*&company_id=eq.${cid}&order=created_at.asc` }),
    ]);
  db.products = products || [];
  db.sales = sales || [];
  db.saleItems = saleItems || [];
  db.purchases = purchases || [];
  db.purchaseItems = purchaseItems || [];
  db.collections = collections || [];
  db.expenses = expenses || [];
  db.members = members || [];
}

async function loadCompany() {
  const rows = await rest("company_members", {
    query: `select=company_id,role,display_name&user_id=eq.${userId}`,
  });
  const m = rows && rows[0];
  if (!m) {
    setCompany(null);
    return;
  }
  const cos = await rest("companies", { query: `select=id,name,invite_code&id=eq.${m.company_id}` });
  const c = cos && cos[0];
  if (!c) {
    setCompany(null);
    return;
  }
  setCompany({ id: c.id, name: c.name, inviteCode: c.invite_code, role: m.role });
}

function toast(msg) {
  errMsg = msg || "";
  render();
}

async function boot() {
  if (!configured()) {
    render();
    return;
  }
  loading = true;
  errMsg = "";
  render();
  try {
    await ensureSession();
    await loadCompany();
    if (company) await loadAll();
  } catch (e) {
    errMsg = e.message || String(e);
  }
  loading = false;
  render();
}

function render() {
  const root = document.getElementById("app");
  if (!configured()) {
    root.innerHTML = `
      <div class="boot">
        <p class="eyebrow">MONO CHROME</p>
        <h1>ربط السيرفر</h1>
        <p class="lede">المدير يعمل مشروع مجاني على Supabase مرة واحدة، ويبعت رابط المشروع ومفتاح anon في الشات عشان نثبّتهم في التطبيق.</p>
        <p class="lede">بعد الربط: أنشئ شركة، وابعت كود الدعوة للموظفين. أي منتج أو مبيعة تظهر عند الكل.</p>
      </div>`;
    return;
  }
  if (loading && !company) {
    root.innerHTML = `<div class="boot"><p class="eyebrow">MONO CHROME</p><h1>جاري الاتصال</h1></div>`;
    return;
  }
  if (!company) {
    root.innerHTML = `
      <div class="boot">
        <p class="eyebrow">MONO CHROME</p>
        <h1>دفتر الشركة</h1>
        <p class="lede">البيانات على السيرفر. المدير ينشئ الشركة، والموظف يدخل بكود الدعوة.</p>
        ${errMsg ? `<p class="warn">${esc(errMsg)}</p>` : ""}
        <form id="create-form">
          <div class="field"><label>اسم الشركة</label><input name="name" required placeholder="Mono Chrome" /></div>
          <div class="field"><label>اسمك</label><input name="display" value="مدير" /></div>
          <button class="btn" type="submit">إنشاء شركة (مدير)</button>
        </form>
        <p class="lede" style="margin-top:24px">عندك كود دعوة؟</p>
        <form id="join-form">
          <div class="field"><label>كود الدعوة</label><input name="code" required placeholder="ABC123" /></div>
          <div class="field"><label>اسمك</label><input name="display" value="موظف" /></div>
          <button class="btn ghost" type="submit">انضمام</button>
        </form>
      </div>`;
    document.getElementById("create-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await ensureSession();
        const c = await rpc("create_company", {
          p_name: e.target.name.value,
          p_display: e.target.display.value,
        });
        setCompany(c);
        await loadAll();
        errMsg = "";
        render();
      } catch (err) {
        toast(err.message);
      }
    };
    document.getElementById("join-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await ensureSession();
        const c = await rpc("join_company", {
          p_code: e.target.code.value,
          p_display: e.target.display.value,
        });
        setCompany(c);
        await loadAll();
        errMsg = "";
        render();
      } catch (err) {
        toast(err.message);
      }
    };
    return;
  }

  root.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">MONO CHROME</p>
        <p class="company">${esc(company.name)}</p>
      </div>
      <span class="badge">${canEdit() ? "مدير" : "مشاهد"}</span>
    </header>
    <main class="page">${pageHtml()}</main>
    <nav class="nav">
      ${PAGES.map(([id, label]) => `<button data-page="${id}">${esc(label)}</button>`).join("")}
    </nav>
    ${modal ? `<div class="modal" id="modal">${modal}</div>` : ""}
  `;
  root.querySelectorAll(".nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === navId());
    b.onclick = () => {
      page = b.dataset.page;
      modal = null;
      render();
    };
  });
  bindPage();
  if (modal) bindModal();
}

function navId() {
  if (["collections", "expenses", "team"].includes(page)) return "more";
  return page;
}

function pageHtml() {
  if (page === "home") return homeHtml();
  if (page === "products") return productsHtml();
  if (page === "sales") return salesHtml();
  if (page === "purchases") return purchasesHtml();
  if (page === "collections") return collectionsHtml();
  if (page === "expenses") return expensesHtml();
  return moreHtml();
}

function homeHtml() {
  const coll = round(db.collections.filter((x) => inPeriod(x.collected_at)).reduce((s, x) => s + num(x.amount), 0));
  const sales = round(db.sales.filter((x) => inPeriod(x.sale_date)).reduce((s, x) => s + num(x.total), 0));
  const paid = round(db.purchases.filter((x) => inPeriod(x.purchase_date)).reduce((s, x) => s + num(x.paid_amount), 0));
  const exp = round(db.expenses.filter((x) => inPeriod(x.expense_date)).reduce((s, x) => s + num(x.amount), 0));
  const recv = round(db.sales.reduce((s, x) => s + Math.max(0, num(x.total) - saleCollected(x.id)), 0));
  const stock = round(db.products.reduce((s, p) => s + num(p.stock_qty) * num(p.cost_price), 0));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const v = db.collections.filter((x) => String(x.collected_at).slice(0, 10) === iso).reduce((s, x) => s + num(x.amount), 0);
    days.push({ v, label: String(d.getDate()) });
  }
  const max = Math.max(1, ...days.map((d) => d.v));
  return `
    <h1>صافي الصندوق</h1>
    <p class="lede">تحصيلات − سداد مشتريات − مصاريف · متزامن مع السيرفر</p>
    ${errMsg ? `<p class="warn">${esc(errMsg)}</p>` : ""}
    <div class="period">
      <button data-period="week" class="${period === "week" ? "on" : ""}">أسبوع</button>
      <button data-period="month" class="${period === "month" ? "on" : ""}">شهر</button>
      <button data-period="year" class="${period === "year" ? "on" : ""}">سنة</button>
    </div>
    <section class="hero" style="margin-top:14px">
      <p class="label">صافي الصندوق الآن</p>
      <p class="value">${money(cashNet())}</p>
      <p class="hint">الجنيه المصري</p>
    </section>
    <div class="kpis">
      <div class="kpi"><p class="label">تحصيلات الفترة</p><p class="value">${money(coll)}</p></div>
      <div class="kpi"><p class="label">مبيعات الفترة</p><p class="value">${money(sales)}</p></div>
      <div class="kpi"><p class="label">سداد مشتريات</p><p class="value">${money(paid)}</p></div>
      <div class="kpi"><p class="label">مصاريف الفترة</p><p class="value">${money(exp)}</p></div>
      <div class="kpi"><p class="label">مستحق عند العملاء</p><p class="value">${money(recv)}</p></div>
      <div class="kpi"><p class="label">قيمة المخزون</p><p class="value">${money(stock)}</p></div>
    </div>
    <article class="card">
      <h2>تحصيلات آخر 7 أيام</h2>
      <div class="bars">${days.map((d) => `<div class="bar"><span style="height:${Math.max(8, (d.v / max) * 100)}%"></span><small>${d.label}</small></div>`).join("")}</div>
    </article>
  `;
}

function addBtn(id, label) {
  return canEdit() ? `<button class="btn" id="${id}">${label}</button>` : "";
}

function productsHtml() {
  return `
    <div class="toolbar"><h1>المنتجات</h1>${addBtn("add-product", "إضافة")}</div>
    ${
      db.products.length
        ? `<ul class="list">${db.products
            .map(
              (p) => `<li>
                <div><strong>${esc(p.name)}</strong><p class="meta">${esc(p.sku || "بدون كود")} · مخزون ${num(p.stock_qty)} ${esc(p.unit || "قطعة")}</p></div>
                <div class="row-actions"><strong>${money(p.sale_price)}</strong>${canEdit() ? `<button class="linkish" data-del-product="${p.id}">حذف</button>` : ""}</div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد منتجات بعد</div>`
    }
  `;
}

function salesHtml() {
  return `
    <div class="toolbar"><h1>المبيعات</h1>${addBtn("add-sale", "فاتورة")}</div>
    ${
      db.sales.length
        ? `<ul class="list">${db.sales
            .map((s) => {
              const left = round(num(s.total) - saleCollected(s.id));
              return `<li>
                <div><strong>${esc(s.invoice_number)} · ${esc(s.customer_name)}</strong><p class="meta">${esc(s.sale_date)} · ${left > 0 ? "متبقي " + money(left) : "محصّلة"}</p></div>
                <div class="row-actions"><strong>${money(s.total)}</strong>${canEdit() ? `<button class="linkish" data-del-sale="${s.id}">حذف</button>` : ""}</div>
              </li>`;
            })
            .join("")}</ul>`
        : `<div class="empty">لا توجد مبيعات بعد</div>`
    }
  `;
}

function purchasesHtml() {
  return `
    <div class="toolbar"><h1>المشتريات</h1>${addBtn("add-purchase", "فاتورة")}</div>
    ${
      db.purchases.length
        ? `<ul class="list">${db.purchases
            .map(
              (p) => `<li>
                <div><strong>${esc(p.invoice_number)} · ${esc(p.supplier_name)}</strong><p class="meta">${esc(p.purchase_date)} · مدفوع ${money(p.paid_amount)}</p></div>
                <div class="row-actions"><strong>${money(p.total)}</strong>${canEdit() ? `<button class="linkish" data-del-purchase="${p.id}">حذف</button>` : ""}</div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد مشتريات بعد</div>`
    }
  `;
}

function collectionsHtml() {
  return `
    <div class="toolbar"><h1>التحصيلات</h1>${addBtn("add-collection", "تحصيل")}</div>
    ${
      db.collections.length
        ? `<ul class="list">${db.collections
            .map(
              (c) => `<li>
                <div><strong>${esc(c.customer_name)}</strong><p class="meta">${esc(c.collected_at)}</p></div>
                <div class="row-actions"><strong>${money(c.amount)}</strong>${canEdit() ? `<button class="linkish" data-del-collection="${c.id}">حذف</button>` : ""}</div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد تحصيلات بعد</div>`
    }
  `;
}

function expensesHtml() {
  return `
    <div class="toolbar"><h1>المصاريف</h1>${addBtn("add-expense", "مصروف")}</div>
    ${
      db.expenses.length
        ? `<ul class="list">${db.expenses
            .map(
              (e) => `<li>
                <div><strong>${esc(e.category)}</strong><p class="meta">${esc(e.expense_date)} · ${esc(e.description || "")}</p></div>
                <div class="row-actions"><strong>${money(e.amount)}</strong>${canEdit() ? `<button class="linkish" data-del-expense="${e.id}">حذف</button>` : ""}</div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد مصاريف بعد</div>`
    }
  `;
}

function moreHtml() {
  return `
    <h1>المزيد</h1>
    <ul class="list">
      <li><button class="linkish" data-go="collections" style="color:inherit;font-size:16px;font-weight:600">التحصيلات</button></li>
      <li><button class="linkish" data-go="expenses" style="color:inherit;font-size:16px;font-weight:600">المصاريف</button></li>
    </ul>
    <article class="card">
      <h2>كود الدعوة</h2>
      <p class="value" style="font-size:28px;margin:8px 0">${esc(company.inviteCode || "")}</p>
      <p class="lede">ابعت الكود للموظف. يسجّل دخول وينضم كمشاهد.</p>
      ${canEdit() ? `<button class="btn ghost" id="rotate-code">تغيير الكود</button>` : ""}
    </article>
    <article class="card">
      <h2>الفريق</h2>
      <ul class="list" style="margin:0;box-shadow:none">${db.members
        .map((m) => `<li><span>${esc(m.display_name || m.user_id.slice(0, 8))}</span><span class="meta">${m.role === "manager" ? "مدير" : "مشاهد"}</span></li>`)
        .join("")}</ul>
    </article>
  `;
}

function bindPage() {
  document.querySelectorAll("[data-period]").forEach((b) => {
    b.onclick = () => {
      period = b.dataset.period;
      render();
    };
  });
  document.querySelectorAll("[data-go]").forEach((b) => {
    b.onclick = () => {
      page = b.dataset.go;
      render();
    };
  });
  const addP = document.getElementById("add-product");
  if (addP) addP.onclick = productModal;
  const addS = document.getElementById("add-sale");
  if (addS) addS.onclick = saleModal;
  const addPu = document.getElementById("add-purchase");
  if (addPu) addPu.onclick = purchaseModal;
  const addC = document.getElementById("add-collection");
  if (addC) addC.onclick = collectionModal;
  const addE = document.getElementById("add-expense");
  if (addE) addE.onclick = expenseModal;
  const rot = document.getElementById("rotate-code");
  if (rot)
    rot.onclick = async () => {
      try {
        const code = nid().replace(/-/g, "").slice(0, 6).toUpperCase();
        await rest("companies", { method: "PATCH", query: `id=eq.${company.id}`, body: { invite_code: code } });
        company.inviteCode = code;
        setCompany(company);
        render();
      } catch (e) {
        toast(e.message);
      }
    };
  document.querySelectorAll("[data-del-product]").forEach((b) => {
    b.onclick = () => del("products", b.dataset.delProduct);
  });
  document.querySelectorAll("[data-del-sale]").forEach((b) => {
    b.onclick = () => delSale(b.dataset.delSale);
  });
  document.querySelectorAll("[data-del-purchase]").forEach((b) => {
    b.onclick = () => delPurchase(b.dataset.delPurchase);
  });
  document.querySelectorAll("[data-del-collection]").forEach((b) => {
    b.onclick = () => del("collections", b.dataset.delCollection);
  });
  document.querySelectorAll("[data-del-expense]").forEach((b) => {
    b.onclick = () => del("expenses", b.dataset.delExpense);
  });
}

async function del(table, id) {
  try {
    await rest(table, { method: "DELETE", query: `id=eq.${id}` });
    await loadAll();
    render();
  } catch (e) {
    toast(e.message);
  }
}

async function delSale(id) {
  const items = db.saleItems.filter((i) => i.sale_id === id);
  try {
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.product_id);
      if (p) {
        await rest("products", {
          method: "PATCH",
          query: `id=eq.${p.id}`,
          body: { stock_qty: round(num(p.stock_qty) + num(it.qty)) },
        });
      }
    }
    await rest("sale_items", { method: "DELETE", query: `sale_id=eq.${id}` });
    await rest("collections", { method: "DELETE", query: `sale_id=eq.${id}` });
    await rest("sales", { method: "DELETE", query: `id=eq.${id}` });
    await loadAll();
    render();
  } catch (e) {
    toast(e.message);
  }
}

async function delPurchase(id) {
  const items = db.purchaseItems.filter((i) => i.purchase_id === id);
  try {
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.product_id);
      if (p) {
        await rest("products", {
          method: "PATCH",
          query: `id=eq.${p.id}`,
          body: { stock_qty: round(Math.max(0, num(p.stock_qty) - num(it.qty))) },
        });
      }
    }
    await rest("purchase_items", { method: "DELETE", query: `purchase_id=eq.${id}` });
    await rest("purchases", { method: "DELETE", query: `id=eq.${id}` });
    await loadAll();
    render();
  } catch (e) {
    toast(e.message);
  }
}

function sheet(title, body) {
  modal = `<div class="sheet"><div class="toolbar"><h1 style="font-size:20px">${esc(title)}</h1><button class="btn ghost" id="close-modal">إغلاق</button></div>${body}</div>`;
  render();
}
function closeModal() {
  modal = null;
  render();
}
function bindModal() {
  const close = document.getElementById("close-modal");
  if (close) close.onclick = closeModal;
  const pf = document.getElementById("product-form");
  if (pf) pf.onsubmit = saveProduct;
  const sf = document.getElementById("sale-form");
  if (sf) {
    sf.onsubmit = saveSale;
    const addLine = document.getElementById("add-line");
    if (addLine) addLine.onclick = () => addLineRow("sale-lines", false);
  }
  const puf = document.getElementById("purchase-form");
  if (puf) {
    puf.onsubmit = savePurchase;
    const addLine = document.getElementById("add-line");
    if (addLine) addLine.onclick = () => addLineRow("purchase-lines", true);
  }
  const cf = document.getElementById("collection-form");
  if (cf) cf.onsubmit = saveCollection;
  const ef = document.getElementById("expense-form");
  if (ef) ef.onsubmit = saveExpense;
}

function productOptions() {
  return db.products.map((p) => `<option value="${p.id}">${esc(p.name)} (${num(p.stock_qty)})</option>`).join("");
}
function addLineRow(id, cost) {
  const wrap = document.getElementById(id);
  const row = document.createElement("div");
  row.className = "line-item";
  row.innerHTML = `<select name="productId">${productOptions()}</select><input name="qty" type="number" min="0.001" step="0.001" value="1" /><input name="price" type="number" min="0" step="0.01" value="0" /><button type="button" class="linkish">×</button>`;
  const sel = row.querySelector("select");
  const price = row.querySelector('input[name="price"]');
  const fill = () => {
    const p = db.products.find((x) => x.id === sel.value);
    if (p) price.value = cost ? p.cost_price : p.sale_price;
  };
  sel.onchange = fill;
  fill();
  row.querySelector("button").onclick = () => row.remove();
  wrap.appendChild(row);
}
function readLines(id) {
  return [...document.querySelectorAll(`#${id} .line-item`)].map((row) => ({
    productId: row.querySelector("select").value,
    qty: round(row.querySelector('input[name="qty"]').value),
    price: round(row.querySelector('input[name="price"]').value),
  }));
}

function productModal() {
  sheet(
    "منتج جديد",
    `<form id="product-form">
      <div class="field"><label>الاسم</label><input name="name" required /></div>
      <div class="field"><label>الكود</label><input name="sku" /></div>
      <div class="field"><label>وحدة</label><input name="unit" value="قطعة" /></div>
      <div class="field"><label>سعر التكلفة</label><input name="cost" type="number" step="0.01" min="0" value="0" /></div>
      <div class="field"><label>سعر البيع</label><input name="price" type="number" step="0.01" min="0" value="0" /></div>
      <div class="field"><label>المخزون</label><input name="stock" type="number" step="0.001" min="0" value="0" /></div>
      <button class="btn" type="submit">حفظ</button>
    </form>`,
  );
}

async function saveProduct(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await rest("products", {
      method: "POST",
      body: {
        id: nid(),
        company_id: company.id,
        name: f.name.value.trim(),
        sku: f.sku.value.trim() || null,
        unit: f.unit.value.trim() || "قطعة",
        cost_price: round(f.cost.value),
        sale_price: round(f.price.value),
        stock_qty: round(f.stock.value),
        created_by: userId,
      },
    });
    await loadAll();
    closeModal();
  } catch (err) {
    toast(err.message);
  }
}

function saleModal() {
  if (!db.products.length) return toast("أضف منتجاً أولاً");
  sheet(
    "فاتورة بيع",
    `<form id="sale-form">
      <div class="field"><label>العميل</label><input name="customer" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <div id="sale-lines"></div>
      <button type="button" class="btn ghost" id="add-line" style="margin-bottom:12px">سطر</button>
      <div class="field"><label>تحصيل الآن</label><input name="collected" type="number" step="0.01" min="0" value="0" /></div>
      <p class="warn" id="form-error"></p>
      <button class="btn" type="submit">حفظ وخصم المخزون</button>
    </form>`,
  );
  addLineRow("sale-lines", false);
}

async function saveSale(e) {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById("form-error");
  const items = readLines("sale-lines").filter((x) => x.qty > 0);
  if (!items.length) {
    err.textContent = "أضف صنفاً";
    return;
  }
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (!p || num(p.stock_qty) + 1e-9 < it.qty) {
      err.textContent = `المخزون لا يكفي`;
      return;
    }
  }
  const total = round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const id = nid();
  const n = db.sales.length + 1;
  const invoice = `S-${String(n).padStart(4, "0")}`;
  try {
    await rest("sales", {
      method: "POST",
      body: {
        id,
        company_id: company.id,
        invoice_number: invoice,
        customer_name: f.customer.value.trim(),
        sale_date: f.date.value,
        total,
        created_by: userId,
      },
    });
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.productId);
      await rest("sale_items", {
        method: "POST",
        body: {
          id: nid(),
          sale_id: id,
          product_id: it.productId,
          product_name: p.name,
          qty: it.qty,
          unit_price: it.price,
        },
      });
      await rest("products", {
        method: "PATCH",
        query: `id=eq.${p.id}`,
        body: { stock_qty: round(num(p.stock_qty) - it.qty) },
      });
    }
    const collected = round(f.collected.value);
    if (collected > 0) {
      await rest("collections", {
        method: "POST",
        body: {
          id: nid(),
          company_id: company.id,
          sale_id: id,
          customer_name: f.customer.value.trim(),
          amount: Math.min(collected, total),
          collected_at: f.date.value,
          created_by: userId,
        },
      });
    }
    await loadAll();
    closeModal();
  } catch (ex) {
    err.textContent = ex.message;
  }
}

function purchaseModal() {
  if (!db.products.length) return toast("أضف منتجاً أولاً");
  sheet(
    "فاتورة شراء",
    `<form id="purchase-form">
      <div class="field"><label>المورد</label><input name="supplier" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <div id="purchase-lines"></div>
      <button type="button" class="btn ghost" id="add-line" style="margin-bottom:12px">سطر</button>
      <div class="field"><label>المدفوع الآن</label><input name="paid" type="number" step="0.01" min="0" value="0" /></div>
      <p class="warn" id="form-error"></p>
      <button class="btn" type="submit">حفظ وزيادة المخزون</button>
    </form>`,
  );
  addLineRow("purchase-lines", true);
}

async function savePurchase(e) {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById("form-error");
  const items = readLines("purchase-lines").filter((x) => x.qty > 0);
  if (!items.length) {
    err.textContent = "أضف صنفاً";
    return;
  }
  const total = round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const id = nid();
  const invoice = `P-${String(db.purchases.length + 1).padStart(4, "0")}`;
  try {
    await rest("purchases", {
      method: "POST",
      body: {
        id,
        company_id: company.id,
        invoice_number: invoice,
        supplier_name: f.supplier.value.trim(),
        purchase_date: f.date.value,
        total,
        paid_amount: round(f.paid.value),
        created_by: userId,
      },
    });
    for (const it of items) {
      const p = db.products.find((x) => x.id === it.productId);
      await rest("purchase_items", {
        method: "POST",
        body: {
          id: nid(),
          purchase_id: id,
          product_id: it.productId,
          product_name: p ? p.name : "",
          qty: it.qty,
          unit_cost: it.price,
        },
      });
      if (p) {
        await rest("products", {
          method: "PATCH",
          query: `id=eq.${p.id}`,
          body: { stock_qty: round(num(p.stock_qty) + it.qty) },
        });
      }
    }
    await loadAll();
    closeModal();
  } catch (ex) {
    err.textContent = ex.message;
  }
}

function collectionModal() {
  const openSales = db.sales.filter((s) => saleCollected(s.id) < num(s.total) - 0.001);
  sheet(
    "تحصيل",
    `<form id="collection-form">
      <div class="field"><label>العميل</label><input name="customer" required /></div>
      <div class="field"><label>فاتورة</label>
        <select name="saleId"><option value="">بدون فاتورة</option>
        ${openSales.map((s) => `<option value="${s.id}">${esc(s.invoice_number)} · ${esc(s.customer_name)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>المبلغ</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <button class="btn" type="submit">حفظ</button>
    </form>`,
  );
}

async function saveCollection(e) {
  e.preventDefault();
  const f = e.target;
  let customer = f.customer.value.trim();
  const saleId = f.saleId.value || null;
  if (saleId) {
    const s = db.sales.find((x) => x.id === saleId);
    if (s && !customer) customer = s.customer_name;
  }
  try {
    await rest("collections", {
      method: "POST",
      body: {
        id: nid(),
        company_id: company.id,
        sale_id: saleId,
        customer_name: customer,
        amount: round(f.amount.value),
        collected_at: f.date.value,
        created_by: userId,
      },
    });
    await loadAll();
    closeModal();
  } catch (err) {
    toast(err.message);
  }
}

function expenseModal() {
  sheet(
    "مصروف",
    `<form id="expense-form">
      <div class="field"><label>التصنيف</label><input name="category" required /></div>
      <div class="field"><label>المبلغ</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <div class="field"><label>ملاحظة</label><input name="note" /></div>
      <button class="btn" type="submit">حفظ</button>
    </form>`,
  );
}

async function saveExpense(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await rest("expenses", {
      method: "POST",
      body: {
        id: nid(),
        company_id: company.id,
        category: f.category.value.trim(),
        amount: round(f.amount.value),
        expense_date: f.date.value,
        description: f.note.value.trim() || null,
        created_by: userId,
      },
    });
    await loadAll();
    closeModal();
  } catch (err) {
    toast(err.message);
  }
}

boot();
setInterval(() => {
  if (configured() && company && !modal) {
    loadAll()
      .then(() => render())
      .catch(() => {});
  }
}, 4000);
