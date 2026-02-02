"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") ?? "/dashboard";

  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!res || res.error) {
      toast.error("Credenciais inválidas.");
      return;
    }

    toast.success("Login efetuado com sucesso.");
    router.push(res.url ?? "/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>Usa as tuas credenciais para aceder à plataforma.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="tu@exemplo.pt" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "A entrar..." : "Entrar"}
              </Button>

              <p className="text-sm text-muted-foreground">
                Ainda não tens conta?{" "}
                <a href="/register" className="underline underline-offset-4">
                  Registar
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
