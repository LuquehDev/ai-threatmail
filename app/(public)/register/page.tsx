// app/(public)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    if (password.length < 6) {
      setLoading(false);
      toast.error("A password deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setLoading(false);
      toast.error("As passwords não coincidem.");
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Não foi possível criar a conta.");
      return;
    }

    toast.success("Conta criada. Agora faz login.");
    router.push("/login");
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <CardDescription>Regista-te para começares a analisar emails.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="tu@exemplo.pt" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="mín. 6 caracteres" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar password</Label>
                <Input id="confirm" name="confirm" type="password" placeholder="repete a password" required />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "A criar..." : "Criar conta"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Já tens conta?{" "}
                <a href="/login" className="underline underline-offset-4">
                  Entrar
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
