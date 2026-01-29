"use client";

import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type Status = "PENDING" | "SCANNING" | "COMPLETED" | "FAILED";

function statusText(s: Status) {
  if (s === "PENDING") return "Pendente";
  if (s === "SCANNING") return "A analisar…";
  if (s === "COMPLETED") return "Concluído";
  if (s === "FAILED") return "Falhou";
  return s;
}

function statusClass(s: Status) {
  if (s === "PENDING") return "bg-yellow-500 text-black";
  if (s === "SCANNING") return "bg-yellow-500 text-black";
  if (s === "COMPLETED") return "bg-green-600 text-white";
  if (s === "FAILED") return "bg-destructive text-white";
  return "bg-muted text-foreground";
}

export function DashboardChat({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [status, setStatus] = React.useState<Status>("SCANNING");
  const [loading, setLoading] = React.useState(false);

  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setStatus("SCANNING");
      setMessages([
        { id: "u", role: "user", content: "Email submetido. A gerar análise…" },
        { id: "a", role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch(`/api/analysis/${analysisId}/stream`, {
          method: "GET",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Erro no streaming");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Sem stream no response");

        const dec = new TextDecoder("utf-8");
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          acc += dec.decode(value, { stream: true });

          if (cancelled) continue;

          setMessages((prev) =>
            prev.map((m) => (m.id === "a" ? { ...m, content: acc } : m)),
          );
        }

        if (!cancelled) setStatus("COMPLETED");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("FAILED");
          toast.error(e?.message ?? "Falha ao gerar resposta");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* topo: status + id (sem linhas/separators) */}
      <div className="flex items-center justify-between px-2 py-2">
        <div
          className={`text-sm py-2 px-4 rounded-full ${statusClass(status)}`}
        >
          {statusText(status)}
        </div>
        <div className="text-xs text-muted-foreground">ID: {analysisId}</div>
      </div>

      {/* mensagens ocupam 100% do espaço */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full h-full px-2 py-6">
          <div className="space-y-6">
            {messages.map((m) => (
              <ChatRow
                key={m.id}
                role={m.role}
                content={m.content}
                loading={loading}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatRow({
  role,
  content,
  loading,
}: {
  role: Role;
  content: string;
  loading: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className="flex gap-4 justify-start">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback>{isUser ? "U" : "AI"}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {isUser ? "Tu" : "Assistente"}
        </div>

        <div className="mt-1 whitespace-pre-wrap text-sm leading-6">
          {content || (!isUser && loading ? "…" : "")}
        </div>
      </div>
    </div>
  );
}
