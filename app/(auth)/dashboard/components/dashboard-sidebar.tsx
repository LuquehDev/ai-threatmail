"use client";

import * as React from "react";
import { Plus, MessageSquare, Trash2, Slack } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ChatItem = { id: string; title: string; createdAt: string };

function formatIsoToPt(iso: string, opts?: { timeZone?: string }): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: opts?.timeZone ?? "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DashboardSidebar(props: {
  chats: ChatItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<boolean> | boolean;
  onNew: () => void;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(id: string) {
    if (deletingId) return;

    try {
      setDeletingId(id);
      const ok = await props.onDelete(id);
      if (!ok) return;
      toast.success("Análise apagada.");
    } catch {
      toast.error("Erro ao apagar a análise.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="hidden md:flex w-[310px] shrink-0 flex-col border-r min-h-0">
      <ScrollArea className="flex-1 min-h-0 pt-4">
        <div className="min-h-0">
          <Slack width={32} height={32} className="mx-auto mb-8" />

          <div className="p-3">
            <Button
              onClick={() => router.push("/analysis/new")}
              className="w-full justify-start rounded-xl bg-transparent hover:bg-[#7F5EFF] border-dashed border hover:border-none text-foreground hover:text-white transition-all duration-300 cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova análise
            </Button>

            <div className="mt-4 px-2 py-2 text-xs text-muted-foreground">
              Recentes
            </div>

            <div className="space-y-1 w-full">
              {props.chats.map((c) => {
                const active = props.selectedId === c.id;
                const isDeleting = deletingId === c.id;

                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className={[
                      "w-full overflow-hidden rounded-lg px-3 py-2 text-left transition group select-none",
                      "hover:bg-[#7F5EFF]/80 hover:text-accent-foreground",
                      active ? "bg-[#7F5EFF]/80 text-accent-foreground" : "",
                      isDeleting ? "opacity-60 pointer-events-none" : "",
                    ].join(" ")}
                    onClick={() => props.onSelect(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        props.onSelect(c.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <MessageSquare className="mt-1 h-4 w-4 shrink-0 opacity-80" />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{c.title}</div>
                        <div className="mt-0.5 text-xs text-white/60">
                          {formatIsoToPt(c.createdAt, { timeZone: "UTC" })}
                        </div>
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDelete(c.id);
                            }}
                            className="shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all duration-300 disabled:opacity-50"
                            aria-label="Apagar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="pointer-events-none">
                          Apagar
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
