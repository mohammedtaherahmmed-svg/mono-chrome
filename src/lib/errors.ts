export function errMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "حدث خطأ غير متوقع";
}
