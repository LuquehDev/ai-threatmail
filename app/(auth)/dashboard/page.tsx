import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "./components/dashboard-shell";

export default async function DashboardPage(props: { searchParams: Promise<{ analysisId?: string }> }) {
  const searchParams = await props.searchParams;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { username: true },
  });

  const chats = await prisma.analysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, emailTitle: true, createdAt: true },
  });

  if (!settings) redirect("/onboarding");
  
  return (
    <DashboardShell
      initialChats={chats.map((c) => ({
        id: c.id,
        title: c.emailTitle,
        createdAt: c.createdAt.toISOString(),
      }))}
      initialAnalysisId={searchParams.analysisId ?? null}
      initialUsername={settings?.username ?? null}
    />
  );
}
