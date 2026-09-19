const moneyFmt = new Intl.NumberFormat("en-EG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const qtyFmt = new Intl.NumberFormat("en-EG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatEgp(value: number): string {
  return `${moneyFmt.format(value)} ج.م`;
}

export function formatQty(value: number): string {
  return qtyFmt.format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
