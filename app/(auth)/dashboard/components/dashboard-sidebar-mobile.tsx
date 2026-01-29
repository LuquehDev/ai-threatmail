"use client";

import * as React from "react";
import { PanelLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import type { ChatItem } from "@/app/(auth)/dashboard/components/dashboard-sidebar";

export function DashboardSidebarMobile(props: {
  chats: ChatItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void; // mantemos para consistência; podes usar depois
  onNew: () => void;
}) {
  const router = useRouter();
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-3 top-3 z-50"
            aria-label="Abrir menu"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-[320px] p-0">
          <div className="flex h-full flex-col">
            <ScrollArea className="flex-1">
              <div className="p-3">
                <Button
                  onClick={() => router.push("/analysis/new")}
                  className="w-full justify-start rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova análise
                </Button>

                <div className="mt-4 px-2 py-2 text-xs text-muted-foreground">
                  Recentes
                </div>

                <div className="space-y-1">
                  {props.chats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => props.onSelect(c.id)}
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left transition",
                        "hover:bg-accent",
                        props.selectedId === c.id ? "bg-accent" : "",
                      ].join(" ")}
                    >
                      <div className="truncate text-sm">{c.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.createdAt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
