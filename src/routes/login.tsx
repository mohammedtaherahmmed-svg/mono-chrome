import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/lib/errors";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;
  return <LoginView />;
}

function LoginView() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({ email, password, name });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      await authClient.getSession();
      window.location.href = "/";
    } catch (err) {
      setError(errMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-[11px] font-medium tracking-[0.32em] text-muted">MONO CHROME</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight">دخول الدفتر</h1>
        <p className="mt-2 text-sm text-muted">حسابات الشركة — منتجات، مبيعات، صندوق.</p>

        <div className="mt-8 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                متابعة عبر {p.label === "X" ? "إكس" : p.label === "Google" ? "جوجل" : p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">تسجيل الدخول غير مفعّل.</p>
          )}
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-subtle">
          <span className="h-px flex-1 bg-line" />
          أو بالإيميل
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onEmail} className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          {mode === "signup" ? (
            <Field label="الاسم">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          ) : null}
          <Field label="البريد">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="كلمة السر">
            <Input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "جارٍ…" : mode === "signup" ? "إنشاء حساب" : "دخول"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted hover:text-ink"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "لديك حساب؟ ادخل" : "حساب جديد"}
          </button>
        </form>
      </div>
    </main>
  );
}
