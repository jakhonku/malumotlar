"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui/primitives";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Login" required>
        <Input name="login" autoComplete="username" autoFocus placeholder="masalan: samarqand.urgut" />
      </Field>
      <Field label="Parol" required>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </Button>
    </form>
  );
}
