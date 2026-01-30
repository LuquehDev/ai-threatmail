"use client";

import * as React from "react";
import { toast } from "sonner";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

async function readTextStream(res: Response, onChunk: (chunk: string) => void) {
  const body = res.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export function DashboardChat(props: {
  analysisId: string | null;
  // opcional: se já carregas do server o texto final (replay)
  initialAssistantText?: string | null;
  // opcional: texto do email para mostrar como “mensagem do user”
  initialUserText?: string | null;
}) {
  const { analysisId, initialAssistantText, initialUserText } = props;

  const [messages, setMessages] = React.useState<Msg[]>(() => {
    const init: Msg[] = [];
    if (initialUserText?.trim()) init.push({ role: "user", content: initialUserText });
    if (initialAssistantText?.trim()) init.push({ role: "assistant", content: initialAssistantText });
    return init.length ? init : [];
  });

  const [isStreaming, setIsStreaming] = React.useState(false);

  // evita dupla chamada por analysisId (StrictMode/dev)
  const startedRef = React.useRef<string | null>(null);

  // quando muda de chat/análise, reseta para o novo
  React.useEffect(() => {
    startedRef.current = null;

    const init: Msg[] = [];
    if (initialUserText?.trim()) init.push({ role: "user", content: initialUserText });
    if (initialAssistantText?.trim()) init.push({ role: "assistant", content: initialAssistantText });

    setMessages(init.length ? init : []);
    setIsStreaming(false);
  }, [analysisId, initialAssistantText, initialUserText]);

  React.useEffect(() => {
    if (!analysisId) return;

    // se já tens resposta completa inicial, não precisas streamar
    if (initialAssistantText?.trim()) return;

    // inicia 1x por analysisId
    if (startedRef.current === analysisId) return;
    startedRef.current = analysisId;

    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      try {
        setIsStreaming(true);

        // garante msg “user”
        setMessages((prev) => {
          const hasUser = prev.some((m) => m.role === "user");
          if (hasUser) return prev;
          return [
            ...prev,
            {
              role: "user",
              content: initialUserText?.trim() || "Email submetido. A iniciar análise...",
            },
          ];
        });

        // garante msg “assistant” vazia
        setMessages((prev) => {
          const hasAssistant = prev.some((m) => m.role === "assistant");
          if (hasAssistant) return prev;
          return [...prev, { role: "assistant", content: "" }];
        });

        const res = await fetch(`/api/analysis/${analysisId}/stream`, {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });

        // a rota já não devolve 409, mas fica aqui por segurança
        if (res.status === 409) return;

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          toast.error(txt || "Falha ao iniciar streaming.");
          return;
        }

        await readTextStream(res, (chunk) => {
          if (cancelled) return;

          setMessages((prev) => {
            // atualiza a última mensagem do assistant (ou cria)
            const next = [...prev];
            let idx = -1;
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "assistant") {
                idx = i;
                break;
              }
            }

            if (idx === -1) return [...next, { role: "assistant", content: chunk }];

            next[idx] = { ...next[idx], content: next[idx].content + chunk };
            return next;
          });
        });
      } catch (e: any) {
        const s = `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
        if (s.includes("abort")) return;
        toast.error("Erro durante o streaming.");
      } finally {
        setIsStreaming(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [analysisId, initialAssistantText, initialUserText]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {messages.map((m, i) => (
            <div key={`${m.role}-${i}`} className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[10px]">
                {m.role === "user" ? "EU" : "AI"}
              </div>

              <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed">
                {m.content || (m.role === "assistant" && isStreaming ? "…" : "")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sem input, como pediste */}
      <div className="border-t p-3 text-center text-xs text-muted-foreground">
        {isStreaming ? "A gerar resposta…" : "Uma análise = um email. Para analisar outro, cria uma nova análise."}
      </div>
    </div>
  );
}
