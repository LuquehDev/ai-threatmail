"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ✅ só os providers que tens mesmo
const MALWARE_PROVIDERS = [
  { value: "virustotal", label: "VirusTotal" },
  { value: "metadefender", label: "MetaDefender" },
] as const;

const GROQ_MODELS = [
  { value: "LLAMA_70B", label: "Llama 70B" },
  { value: "LLAMA_8B", label: "Llama 8B" },
] as const;

type MalwareProvider = (typeof MALWARE_PROVIDERS)[number]["value"];
type GroqModel = (typeof GROQ_MODELS)[number]["value"];
type Step = 1 | 2 | 3;

export function OnboardingWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>(1);

  const [username, setUsername] = React.useState("");
  const [malwareProvider, setMalwareProvider] =
    React.useState<MalwareProvider | null>(null);
  const [groqModel, setGroqModel] = React.useState<GroqModel | null>(null);

  const [loading, setLoading] = React.useState(false);

  function next() {
    if (step === 1) {
      if (!username.trim()) {
        toast.error("Define um username.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!malwareProvider) {
        toast.error("Seleciona um serviço de análise de malware.");
        return;
      }
      setStep(3);
    }
  }

  function back() {
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  async function finish() {
    if (!username.trim()) {
      toast.error("Define um username.");
      setStep(1);
      return;
    }
    if (!malwareProvider) {
      toast.error("Seleciona um serviço de análise de malware.");
      setStep(2);
      return;
    }
    if (!groqModel) {
      toast.error("Seleciona o modelo (Groq).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          malwareProvider, // "virustotal" | "metadefender"
          groqModel, // "LLAMA_70B" | "LLAMA_8B"
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        toast.error(j?.error ?? "Erro ao guardar configurações.");
        return;
      }

      toast.success("Configuração concluída.");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast.error("Erro de rede ao guardar configurações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Configuração inicial</CardTitle>
            <CardDescription>
              Só precisas de fazer isto uma vez.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <Steps step={step} />

            <Separator />

            {step === 1 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Username</div>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex.: luizpaiva"
                  autoFocus
                />
                <div className="text-xs text-muted-foreground">
                  Vai aparecer no teu perfil e no histórico.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Serviço de análise de malware
                </div>

                <Select
                  value={malwareProvider ?? ""}
                  onValueChange={(v) =>
                    setMalwareProvider(v as MalwareProvider)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MALWARE_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">
                  Os anexos serão enviados para este serviço durante a análise.
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Modelo (Groq) para a explicação
                </div>

                <Select
                  value={groqModel ?? ""}
                  onValueChange={(v) => setGroqModel(v as GroqModel)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GROQ_MODELS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">
                  O modelo só “humaniza” a explicação final, não existe chat
                  contínuo.
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                onClick={back}
                disabled={step === 1 || loading}
              >
                Voltar
              </Button>

              {step < 3 ? (
                <Button onClick={next} disabled={loading}>
                  Continuar
                </Button>
              ) : (
                <Button onClick={finish} disabled={loading}>
                  {loading ? "A guardar..." : "Concluir"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <StepItem active={step === 1} done={step > 1} label="Conta" />
      <StepItem active={step === 2} done={step > 2} label="Malware" />
      <StepItem active={step === 3} done={false} label="Modelo" />
    </div>
  );
}

function StepItem({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={[
        "rounded-lg border px-3 py-2 text-center",
        done ? "bg-muted" : "",
        active ? "border-foreground/30" : "border-border",
      ].join(" ")}
    >
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        {done ? "Concluído" : active ? "Atual" : "Pendente"}
      </div>
    </div>
  );
}
