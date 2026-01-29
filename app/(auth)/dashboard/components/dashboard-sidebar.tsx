"use client";

import * as React from "react";
import { Plus, MessageSquare, Trash2, Slack } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardFooter } from "@/app/(auth)/dashboard/components/dashboard-footer";

export type ChatItem = { id: string; title: string; createdAt: string };

export function DashboardSidebar(props: {
  chats: ChatItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const router = useRouter();

  return (
    <aside className="hidden md:flex w-[310px] shrink-0 flex-col border-r">
      <ScrollArea className="flex-1 pt-4 w-full overflow-y-auto">
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

          <div className="space-y-1 max-w-[285px]">
            {props.chats.map((c, idx) => {
              const active = props.selectedId === c.id;
              return (
                <div
                  key={c.id}
                  className={[
                    "overflow-hidden rounded-lg px-3 py-2 transition group cursor-pointer",
                    "hover:bg-[#7F5EFF]/80 hover:text-accent-foreground",
                    active ? "bg-[#7F5EFF]/80 text-accent-foreground" : "",
                  ].join(" ")}
                  onClick={() => props.onSelect(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") props.onSelect(c.id);
                  }}
                >
                  <div className="flex items-start gap-2 w-full">
                    <MessageSquare className="mt-1 h-4 w-4 shrink-0 opacity-80" />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.title}</div>
                      <div className="mt-0.5 text-xs text-white/60">
                        {c.createdAt}
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            props.onDelete(c.id);
                          }}
                          className="shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all duration-300"
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
      </ScrollArea>

      <Separator />
      <DashboardFooter />
    </aside>
  );
}
