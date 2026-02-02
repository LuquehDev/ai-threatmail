"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardTopbar } from "./dashboard-topbar";
import { DashboardSidebar, type ChatItem } from "./dashboard-sidebar";
import { DashboardSidebarMobile } from "./dashboard-sidebar-mobile";
import { DashboardHero } from "./dashboard-hero";
import { DashboardChat } from "./dashboard-chat";

type Props = {
  initialChats: ChatItem[];
  initialAnalysisId: string | null;
  initialUsername: string | null;
};

export function DashboardShell({ initialChats, initialAnalysisId, initialUsername }: Props) {
  const router = useRouter();

  const [chats, setChats] = React.useState<ChatItem[]>(initialChats);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialAnalysisId ?? initialChats[0]?.id ?? null
  );

  React.useEffect(() => {
    if (selectedId && !chats.some((c) => c.id === selectedId)) {
      const next = chats[0]?.id ?? null;
      setSelectedId(next);
      router.push(next ? `/dashboard?analysisId=${next}` : "/dashboard");
    }
  }, [chats, selectedId]);

  function onSelect(id: string) {
    setSelectedId(id);
    router.push(`/dashboard?analysisId=${id}`);
  }

  async function onDeleteChat(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/analysis/${id}/delete`, { method: "DELETE" });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Erro ao apagar a análise.");
        return false;
      }

      const nextList = chats.filter((c) => c.id !== id);
      const nextId = selectedId === id ? (nextList[0]?.id ?? null) : selectedId;

      setChats(nextList);
      setSelectedId(nextId);
      router.push(nextId ? `/dashboard?analysisId=${nextId}` : "/dashboard");

      return true;
    } catch {
      toast.error("Erro ao apagar a análise.");
      return false;
    }
  }

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <div className="flex h-full min-h-0">
        <DashboardSidebar
          chats={chats}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDeleteChat}
          onNew={() => router.push("/analysis/new")}
        />

        <main className="flex-1 flex flex-col min-h-0">
          <DashboardTopbar
            username={initialUsername}
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: selectedId ? "Análise" : "Início" },
            ]}
          />

          <div className="flex-1 p-6 min-h-0">
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
