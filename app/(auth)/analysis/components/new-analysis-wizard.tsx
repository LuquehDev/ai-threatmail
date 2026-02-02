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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

const MAX_FILES = 5;
const MAX_MB = 500;
const MAX_FILE_BYTES = MAX_MB * 1024 * 1024;

type Step = 1 | 2 | 3 | 4;

function fileKey(f: File) {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

export function NewAnalysisWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>(1);
  const [loading, setLoading] = React.useState(false);

  const [emailTitle, setEmailTitle] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");

  const [files, setFiles] = React.useState<File[]>([]);

  const progress = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

  function next() {
    if (step === 1 && !emailTitle.trim()) return toast.error("Preenche o título.");
    if (step === 2 && !emailSubject.trim()) return toast.error("Preenche o assunto.");
    if (step === 3 && !emailBody.trim()) return toast.error("Preenche o corpo do email.");
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  function back() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  function onPickFiles(list: FileList | null) {
    if (!list) return;

    const picked = Array.from(list);

    const tooBig = picked.find((f) => (f.size ?? 0) > MAX_FILE_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" excede ${MAX_MB}MB.`);
      return;
    }

    setFiles((prev) => {
      const map = new Map<string, File>();
      for (const f of prev) map.set(fileKey(f), f);
      for (const f of picked) map.set(fileKey(f), f);

      const merged = Array.from(map.values());

      if (merged.length > MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} ficheiros.`);
        return prev;
      }

      return merged;
    });
  }

  function removeFile(k: string) {
    setFiles((prev) => prev.filter((f) => fileKey(f) !== k));
  }

  async function submit() {
    if (!emailTitle.trim() || !emailSubject.trim() || !emailBody.trim()) {
      toast.error("Faltam campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.set("emailTitle", emailTitle.trim());
      fd.set("emailSubject", emailSubject.trim());
      fd.set("emailBody", emailBody.trim());
      files.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/analysis/create", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Erro ao criar análise.");
        return;
      }

      const j = await res.json().catch(() => ({}));
      const id = j.analysisId as string | undefined;

      if (!id) {
        toast.error("Não foi possível obter o ID da análise.");
        return;
      }

      toast.success("Análise criada. A iniciar processamento…");

      if (files.length > 0) {
        fetch(`/api/analysis/${id}/scan`, { method: "POST" }).catch(() => {
        });
      }

      router.push(`/dashboard?analysisId=${id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Nova análise</CardTitle>
            <CardDescription>Segue os 4 passos para analisar o email.</CardDescription>
            <Progress value={progress} />
          </CardHeader>

          <CardContent className="space-y-6">
            <Steps step={step} />
            <Separator />

            {step === 1 ? <StepTitle value={emailTitle} onChange={setEmailTitle} /> : null}
            {step === 2 ? <StepSubject value={emailSubject} onChange={setEmailSubject} /> : null}
            {step === 3 ? <StepBody value={emailBody} onChange={setEmailBody} /> : null}
            {step === 4 ? (
              <StepFiles
                files={files}
                onPick={onPickFiles}
                onRemove={removeFile}
              />
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={back} disabled={step === 1 || loading}>
                Voltar
              </Button>

              {step < 4 ? (
                <Button onClick={next} disabled={loading}>
                  Continuar
                </Button>
              ) : (
                <Button onClick={submit} disabled={loading}>
                  {loading ? "A criar..." : "Iniciar análise"}
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
    <div className="grid grid-cols-4 gap-2 text-xs">
      <StepItem active={step === 1} done={step > 1} label="Título" />
      <StepItem active={step === 2} done={step > 2} label="Assunto" />
      <StepItem active={step === 3} done={step > 3} label="Corpo" />
      <StepItem active={step === 4} done={false} label="Ficheiros" />
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

function StepTitle(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Título do email</div>
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder='ex.: "Fatura em atraso"'
        autoFocus
      />
      <div className="text-xs text-muted-foreground">
        Um título curto para identificares esta análise no histórico.
      </div>
    </div>
  );
}

function StepSubject(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Assunto</div>
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder='ex.: "Pagamento pendente"'
        autoFocus
      />
    </div>
  );
}

function StepBody(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Corpo do email</div>
      <Textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="Cola aqui o conteúdo completo do email..."
        className="min-h-[220px]"
        autoFocus
      />
      <div className="text-xs text-muted-foreground">
        Quanto mais completo, melhor a análise.
      </div>
    </div>
  );
}

function StepFiles(props: {
  files: File[];
  onPick: (list: FileList | null) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Ficheiros (opcional)</div>

      <Input type="file" multiple onChange={(e) => props.onPick(e.target.files)} />

      <div className="text-xs text-muted-foreground">
        Máximo: {MAX_FILES} ficheiros • até {MAX_MB}MB cada.
      </div>

      {props.files.length ? (
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium mb-2">Selecionados</div>
          <ul className="space-y-2 text-sm">
            {props.files.map((f) => {
              const k = fileKey(f);
              return (
                <li key={k} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(f.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => props.onRemove(k)}
                  >
                    Remover
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
