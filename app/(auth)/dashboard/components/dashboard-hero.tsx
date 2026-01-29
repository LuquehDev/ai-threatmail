"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DashboardHero() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center mb-20">
      <h1 className="text-5xl font-semibold tracking-tight text-center">
        Vamos analisar um novo email?
      </h1>

      <p className="text-md text-muted-foreground text-center max-w-md mt-2">
        Inicia uma nova análise manual de email com deteção de spam, phishing e malware.
      </p>

      <Button
        size="lg"
        className="rounded-2xl px-8 py-6 text-base mt-8"
        onClick={() => router.push("/analysis/new")}
      >
        <Plus className="mr-2 h-5 w-5" />
        Iniciar nova análise
      </Button>
    </div>
  );
}
