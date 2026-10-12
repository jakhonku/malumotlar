"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui/primitives";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Yangi parol" required hint="Kamida 8 belgi">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Parolni takrorlang" required>
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      {state.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm font-medium text-emerald-700">Parol muvaffaqiyatli o‘zgartirildi</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saqlanmoqda…" : "Parolni o‘zgartirish"}</Button>
    </form>
  );
}
