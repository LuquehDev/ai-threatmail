"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "./dashboard-topbar";
import { DashboardSidebar, type ChatItem } from "./dashboard-sidebar";
import { DashboardSidebarMobile } from "./dashboard-sidebar-mobile";
import { DashboardHero } from "./dashboard-hero";
import { DashboardChat } from "./dashboard-chat";

type Props = {
  initialChats: ChatItem[];
  initialAnalysisId: string | null;
};

export function DashboardShell({ initialChats, initialAnalysisId }: Props) {
  const router = useRouter();

  const [chats, setChats] = React.useState<ChatItem[]>(initialChats);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialAnalysisId ?? (initialChats[0]?.id ?? null)
  );

  // quando seleciona um chat, atualiza URL para permitir refresh/bookmark
  function onSelect(id: string) {
    setSelectedId(id);
    router.push(`/dashboard?analysisId=${id}`);
  }

  function onDeleteChat(id: string) {
    // (por agora só remove da UI; mais tarde ligas a endpoint para apagar do DB)
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      const next = chats.find((c) => c.id !== id)?.id ?? null;
      setSelectedId(next);
      router.push(next ? `/dashboard?analysisId=${next}` : "/dashboard");
    }
  }

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <div className="flex h-full">
        <DashboardSidebar
          chats={chats}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDeleteChat}
          onNew={() => router.push("/analysis/new")}
        />

        <main className="flex-1 flex flex-col">
          <DashboardTopbar
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: selectedId ? "Análise" : "Início" },
            ]}
          />

          <div className="flex-1 p-6">
            <div className="flex items-center justify-center h-full w-full">
              {!selectedId ? <DashboardHero /> : <DashboardChat analysisId={selectedId} />}
            </div>
          </div>
        </main>

        <DashboardSidebarMobile
          chats={chats}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDeleteChat}
          onNew={() => router.push("/analysis/new")}
        />
      </div>
    </div>
  );
}
