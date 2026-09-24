const KEY = "mono-chrome-ledger-v1";
const PAGES = [
  ["home", "الرئيسية"],
  ["products", "المنتجات"],
  ["sales", "المبيعات"],
  ["purchases", "المشتريات"],
  ["more", "المزيد"],
];

function nid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function today() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function money(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("en-EG", { maximumFractionDigits: 2 })} ج.م`;
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

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function blank() {
  return {
    companyName: "",
    products: [],
    sales: [],
    purchases: [],
    collections: [],
    expenses: [],
    seqSale: 1,
    seqPurchase: 1,
  };
}

let db = Object.assign(blank(), load() || {});
let page = "home";
let period = "month";
let modal = null;

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function inPeriod(iso) {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  const now = new Date();
  const from = new Date(now);
  if (period === "week") from.setDate(now.getDate() - 6);
  else if (period === "month") from.setDate(1);
  else from.setMonth(0, 1);
  const a = d;
  const b = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const c = today();
  return a >= b && a <= c;
}

function cashNet() {
  const coll = db.collections.reduce((s, x) => s + Number(x.amount), 0);
  const paid = db.purchases.reduce((s, x) => s + Number(x.paidAmount), 0);
  const exp = db.expenses.reduce((s, x) => s + Number(x.amount), 0);
  return round(coll - paid - exp);
}

function productById(id) {
  return db.products.find((p) => p.id === id);
}

function saleCollected(saleId) {
  return round(
    db.collections.filter((c) => c.saleId === saleId).reduce((s, x) => s + Number(x.amount), 0),
  );
}

function audit(action, entity, details) {
  db.audit = db.audit || [];
  db.audit.unshift({ id: nid(), action, entity, details, at: new Date().toISOString() });
  db.audit = db.audit.slice(0, 100);
}

function openModal(html) {
  modal = html;
  render();
}

function closeModal() {
  modal = null;
  render();
}

function render() {
  const root = document.getElementById("app");
  if (!db.companyName) {
    root.innerHTML = `
      <div class="boot">
        <p class="eyebrow">MONO CHROME</p>
        <h1>دفتر الشركة</h1>
        <p class="lede">بدون رابط نشر. الحسابات تتحفظ على هذا الموبايل.</p>
        <form id="boot-form">
          <div class="field">
            <label>اسم الشركة</label>
            <input name="name" required placeholder="Mono Chrome" />
          </div>
          <button class="btn" type="submit">ابدأ</button>
        </form>
      </div>`;
    document.getElementById("boot-form").onsubmit = (e) => {
      e.preventDefault();
      db.companyName = e.target.name.value.trim() || "Mono Chrome";
      save();
      render();
    };
    return;
  }

  root.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">MONO CHROME</p>
        <p class="company">${esc(db.companyName)}</p>
      </div>
      <span class="badge">مدير</span>
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
  const coll = round(db.collections.filter((x) => inPeriod(x.date)).reduce((s, x) => s + Number(x.amount), 0));
  const sales = round(db.sales.filter((x) => inPeriod(x.date)).reduce((s, x) => s + Number(x.total), 0));
  const paid = round(db.purchases.filter((x) => inPeriod(x.date)).reduce((s, x) => s + Number(x.paidAmount), 0));
  const exp = round(db.expenses.filter((x) => inPeriod(x.date)).reduce((s, x) => s + Number(x.amount), 0));
  const recv = round(
    db.sales.reduce((s, x) => s + Math.max(0, Number(x.total) - saleCollected(x.id)), 0),
  );
  const stock = round(db.products.reduce((s, p) => s + Number(p.stock) * Number(p.cost), 0));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const v = db.collections.filter((x) => x.date === iso).reduce((s, x) => s + Number(x.amount), 0);
    days.push({ iso, v, label: String(d.getDate()) });
  }
  const max = Math.max(1, ...days.map((d) => d.v));
  return `
    <div class="toolbar">
      <div>
        <h1>صافي الصندوق</h1>
        <p class="lede">تحصيلات − سداد مشتريات − مصاريف</p>
      </div>
    </div>
    <div class="period">
      <button data-period="week" class="${period === "week" ? "on" : ""}">أسبوع</button>
      <button data-period="month" class="${period === "month" ? "on" : ""}">شهر</button>
      <button data-period="year" class="${period === "year" ? "on" : ""}">سنة</button>
    </div>
    <section class="hero" style="margin-top:14px">
      <p class="label">صافي الصندوق الآن</p>
      <p class="value">${money(cashNet())}</p>
      <p class="hint">الجنيه المصري · محفوظ على الجهاز</p>
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
      <div class="bars">${days
        .map(
          (d) =>
            `<div class="bar"><span style="height:${Math.max(8, (d.v / max) * 100)}%"></span><small>${d.label}</small></div>`,
        )
        .join("")}</div>
    </article>
  `;
}

function productsHtml() {
  return `
    <div class="toolbar">
      <h1>المنتجات</h1>
      <button class="btn" id="add-product">إضافة</button>
    </div>
    ${
      db.products.length
        ? `<ul class="list">${db.products
            .map(
              (p) => `<li>
                <div>
                  <strong>${esc(p.name)}</strong>
                  <p class="meta">${esc(p.sku || "بدون كود")} · مخزون ${p.stock} ${esc(p.unit || "قطعة")}</p>
                </div>
                <div class="row-actions">
                  <strong>${money(p.price)}</strong>
                  <button class="linkish" data-del-product="${p.id}">حذف</button>
                </div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد منتجات بعد</div>`
    }
  `;
}

function salesHtml() {
  return `
    <div class="toolbar">
      <h1>المبيعات</h1>
      <button class="btn" id="add-sale">فاتورة</button>
    </div>
    ${
      db.sales.length
        ? `<ul class="list">${db.sales
            .map((s) => {
              const got = saleCollected(s.id);
              const left = round(s.total - got);
              return `<li>
                <div>
                  <strong>${esc(s.invoice)} · ${esc(s.customer)}</strong>
                  <p class="meta">${esc(s.date)} · ${left > 0 ? "متبقي " + money(left) : "محصّلة"}</p>
                </div>
                <div class="row-actions">
                  <strong>${money(s.total)}</strong>
                  <button class="linkish" data-del-sale="${s.id}">حذف</button>
                </div>
              </li>`;
            })
            .join("")}</ul>`
        : `<div class="empty">لا توجد مبيعات بعد</div>`
    }
  `;
}

function purchasesHtml() {
  return `
    <div class="toolbar">
      <h1>المشتريات</h1>
      <button class="btn" id="add-purchase">فاتورة</button>
    </div>
    ${
      db.purchases.length
        ? `<ul class="list">${db.purchases
            .map(
              (p) => `<li>
                <div>
                  <strong>${esc(p.invoice)} · ${esc(p.supplier)}</strong>
                  <p class="meta">${esc(p.date)} · مدفوع ${money(p.paidAmount)}</p>
                </div>
                <div class="row-actions">
                  <strong>${money(p.total)}</strong>
                  <button class="linkish" data-del-purchase="${p.id}">حذف</button>
                </div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد مشتريات بعد</div>`
    }
  `;
}

function collectionsHtml() {
  return `
    <div class="toolbar">
      <h1>التحصيلات</h1>
      <button class="btn" id="add-collection">تحصيل</button>
    </div>
    ${
      db.collections.length
        ? `<ul class="list">${db.collections
            .map(
              (c) => `<li>
                <div>
                  <strong>${esc(c.customer)}</strong>
                  <p class="meta">${esc(c.date)}</p>
                </div>
                <div class="row-actions">
                  <strong>${money(c.amount)}</strong>
                  <button class="linkish" data-del-collection="${c.id}">حذف</button>
                </div>
              </li>`,
            )
            .join("")}</ul>`
        : `<div class="empty">لا توجد تحصيلات بعد</div>`
    }
  `;
}

function expensesHtml() {
  return `
    <div class="toolbar">
      <h1>المصاريف</h1>
      <button class="btn" id="add-expense">مصروف</button>
    </div>
    ${
      db.expenses.length
        ? `<ul class="list">${db.expenses
            .map(
              (e) => `<li>
                <div>
                  <strong>${esc(e.category)}</strong>
                  <p class="meta">${esc(e.date)} · ${esc(e.note || "")}</p>
                </div>
                <div class="row-actions">
                  <strong>${money(e.amount)}</strong>
                  <button class="linkish" data-del-expense="${e.id}">حذف</button>
                </div>
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
    <p class="lede">التحصيلات والمصاريف وسجل الجهاز</p>
    <ul class="list">
      <li><button class="linkish" data-go="collections" style="color:inherit;font-size:16px;font-weight:600">التحصيلات</button></li>
      <li><button class="linkish" data-go="expenses" style="color:inherit;font-size:16px;font-weight:600">المصاريف</button></li>
    </ul>
    <article class="card">
      <h2>عن النسخة</h2>
      <p class="lede" style="margin:0">التطبيق شغال على الموبايل مباشرة من غير رابط نشر. الأرقام محفوظة على هذا الجهاز. لو فتحت نفس التطبيق على موبايل تاني هتبدأ دفتر مستقل.</p>
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

  document.querySelectorAll("[data-del-product]").forEach((b) => {
    b.onclick = () => {
      db.products = db.products.filter((p) => p.id !== b.dataset.delProduct);
      save();
      render();
    };
  });
  document.querySelectorAll("[data-del-sale]").forEach((b) => {
    b.onclick = () => deleteSale(b.dataset.delSale);
  });
  document.querySelectorAll("[data-del-purchase]").forEach((b) => {
    b.onclick = () => deletePurchase(b.dataset.delPurchase);
  });
  document.querySelectorAll("[data-del-collection]").forEach((b) => {
    b.onclick = () => {
      db.collections = db.collections.filter((c) => c.id !== b.dataset.delCollection);
      save();
      render();
    };
  });
  document.querySelectorAll("[data-del-expense]").forEach((b) => {
    b.onclick = () => {
      db.expenses = db.expenses.filter((e) => e.id !== b.dataset.delExpense);
      save();
      render();
    };
  });
}

function sheet(title, body) {
  openModal(`
    <div class="sheet">
      <div class="toolbar">
        <h1 style="font-size:20px">${esc(title)}</h1>
        <button class="btn ghost" id="close-modal">إغلاق</button>
      </div>
      ${body}
    </div>
  `);
}

function bindModal() {
  const close = document.getElementById("close-modal");
  if (close) close.onclick = closeModal;
  const modalEl = document.getElementById("modal");
  if (modalEl)
    modalEl.onclick = (e) => {
      if (e.target.id === "modal") closeModal();
    };
  const pf = document.getElementById("product-form");
  if (pf) pf.onsubmit = saveProduct;
  const sf = document.getElementById("sale-form");
  if (sf) {
    sf.onsubmit = saveSale;
    const addLine = document.getElementById("add-line");
    if (addLine) addLine.onclick = () => addLineRow("sale-lines");
  }
  const puf = document.getElementById("purchase-form");
  if (puf) {
    puf.onsubmit = savePurchase;
    const addLine = document.getElementById("add-line");
    if (addLine) addLine.onclick = () => addLineRow("purchase-lines");
  }
  const cf = document.getElementById("collection-form");
  if (cf) cf.onsubmit = saveCollection;
  const ef = document.getElementById("expense-form");
  if (ef) ef.onsubmit = saveExpense;
}

function productOptions() {
  return db.products
    .map((p) => `<option value="${p.id}">${esc(p.name)} (${p.stock})</option>`)
    .join("");
}

function addLineRow(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const row = document.createElement("div");
  row.className = "line-item";
  row.innerHTML = `
    <select name="productId">${productOptions()}</select>
    <input name="qty" type="number" min="0.001" step="0.001" value="1" />
    <input name="price" type="number" min="0" step="0.01" value="0" />
    <button type="button" class="linkish">×</button>
  `;
  const sel = row.querySelector("select");
  const price = row.querySelector('input[name="price"]');
  const fill = () => {
    const p = productById(sel.value);
    if (p) price.value = id === "purchase-lines" ? p.cost : p.price;
  };
  sel.onchange = fill;
  fill();
  row.querySelector("button").onclick = () => row.remove();
  wrap.appendChild(row);
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

function saveProduct(e) {
  e.preventDefault();
  const f = e.target;
  db.products.push({
    id: nid(),
    name: f.name.value.trim(),
    sku: f.sku.value.trim(),
    unit: f.unit.value.trim() || "قطعة",
    cost: round(f.cost.value),
    price: round(f.price.value),
    stock: round(f.stock.value),
  });
  audit("create", "product", f.name.value.trim());
  save();
  closeModal();
}

function saleModal() {
  if (!db.products.length) {
    alert("أضف منتجاً أولاً");
    return;
  }
  sheet(
    "فاتورة بيع",
    `<form id="sale-form">
      <div class="field"><label>العميل</label><input name="customer" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <div id="sale-lines"></div>
      <button type="button" class="btn ghost" id="add-line" style="margin-bottom:12px">سطر</button>
      <div class="field"><label>تحصيل الآن (اختياري)</label><input name="collected" type="number" step="0.01" min="0" value="0" /></div>
      <p class="warn" id="form-error"></p>
      <button class="btn" type="submit">حفظ وخصم المخزون</button>
    </form>`,
  );
  addLineRow("sale-lines");
}

function readLines(id) {
  return [...document.querySelectorAll(`#${id} .line-item`)].map((row) => ({
    productId: row.querySelector("select").value,
    qty: round(row.querySelector('input[name="qty"]').value),
    price: round(row.querySelector('input[name="price"]').value),
  }));
}

function saveSale(e) {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById("form-error");
  const items = readLines("sale-lines").filter((x) => x.qty > 0);
  if (!items.length) {
    err.textContent = "أضف صنفاً";
    return;
  }
  for (const it of items) {
    const p = productById(it.productId);
    if (!p) {
      err.textContent = "منتج غير موجود";
      return;
    }
    if (p.stock + 1e-9 < it.qty) {
      err.textContent = `المخزون لا يكفي لـ ${p.name}`;
      return;
    }
  }
  const total = round(items.reduce((s, it) => s + it.qty * it.price, 0));
  const id = nid();
  const invoice = `S-${String(db.seqSale++).padStart(4, "0")}`;
  items.forEach((it) => {
    const p = productById(it.productId);
    p.stock = round(p.stock - it.qty);
  });
  db.sales.unshift({
    id,
    invoice,
    customer: f.customer.value.trim(),
    date: f.date.value,
    total,
    items,
  });
  const collected = round(f.collected.value);
  if (collected > 0) {
    db.collections.unshift({
      id: nid(),
      saleId: id,
      customer: f.customer.value.trim(),
      amount: Math.min(collected, total),
      date: f.date.value,
    });
  }
  audit("create", "sale", invoice);
  save();
  closeModal();
}

function deleteSale(id) {
  const s = db.sales.find((x) => x.id === id);
  if (!s) return;
  (s.items || []).forEach((it) => {
    const p = productById(it.productId);
    if (p) p.stock = round(p.stock + Number(it.qty));
  });
  db.sales = db.sales.filter((x) => x.id !== id);
  db.collections = db.collections.filter((c) => c.saleId !== id);
  save();
  render();
}

function purchaseModal() {
  if (!db.products.length) {
    alert("أضف منتجاً أولاً");
    return;
  }
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
  addLineRow("purchase-lines");
}

function savePurchase(e) {
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
  const invoice = `P-${String(db.seqPurchase++).padStart(4, "0")}`;
  items.forEach((it) => {
    const p = productById(it.productId);
    if (p) p.stock = round(p.stock + it.qty);
  });
  db.purchases.unshift({
    id,
    invoice,
    supplier: f.supplier.value.trim(),
    date: f.date.value,
    total,
    paidAmount: round(f.paid.value),
    items,
  });
  audit("create", "purchase", invoice);
  save();
  closeModal();
}

function deletePurchase(id) {
  const p = db.purchases.find((x) => x.id === id);
  if (!p) return;
  (p.items || []).forEach((it) => {
    const prod = productById(it.productId);
    if (prod) prod.stock = round(Math.max(0, prod.stock - Number(it.qty)));
  });
  db.purchases = db.purchases.filter((x) => x.id !== id);
  save();
  render();
}

function collectionModal() {
  const openSales = db.sales.filter((s) => saleCollected(s.id) < s.total - 0.001);
  sheet(
    "تحصيل",
    `<form id="collection-form">
      <div class="field"><label>العميل</label><input name="customer" required /></div>
      <div class="field"><label>فاتورة (اختياري)</label>
        <select name="saleId">
          <option value="">بدون فاتورة</option>
          ${openSales.map((s) => `<option value="${s.id}">${esc(s.invoice)} · ${esc(s.customer)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>المبلغ</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <button class="btn" type="submit">حفظ</button>
    </form>`,
  );
}

function saveCollection(e) {
  e.preventDefault();
  const f = e.target;
  let customer = f.customer.value.trim();
  const saleId = f.saleId.value || null;
  if (saleId) {
    const s = db.sales.find((x) => x.id === saleId);
    if (s && !customer) customer = s.customer;
  }
  db.collections.unshift({
    id: nid(),
    saleId,
    customer,
    amount: round(f.amount.value),
    date: f.date.value,
  });
  audit("create", "collection", customer);
  save();
  closeModal();
}

function expenseModal() {
  sheet(
    "مصروف",
    `<form id="expense-form">
      <div class="field"><label>التصنيف</label><input name="category" required placeholder="إيجار، كهرباء، نقل..." /></div>
      <div class="field"><label>المبلغ</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" required /></div>
      <div class="field"><label>ملاحظة</label><input name="note" /></div>
      <button class="btn" type="submit">حفظ</button>
    </form>`,
  );
}

function saveExpense(e) {
  e.preventDefault();
  const f = e.target;
  db.expenses.unshift({
    id: nid(),
    category: f.category.value.trim(),
    amount: round(f.amount.value),
    date: f.date.value,
    note: f.note.value.trim(),
  });
  audit("create", "expense", f.category.value.trim());
  save();
  closeModal();
}

render();
