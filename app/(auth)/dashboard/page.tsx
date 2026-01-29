import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "./components/dashboard-shell";

type SP = { analysisId?: string };

export default async function DashboardPage(props: {
  searchParams: Promise<SP> | SP;
}) {
  const searchParams = await Promise.resolve(props.searchParams);

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!settings) redirect("/onboarding");

  const analyses = await prisma.analysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      emailTitle: true,
      createdAt: true,
      status: true,
    },
  });

  const chats = analyses.map((a) => ({
    id: a.id,
    title: a.emailTitle,
    createdAt: a.createdAt.toISOString(),
    status: a.status,
  }));

  return (
    <DashboardShell
      initialChats={chats}
      initialAnalysisId={searchParams.analysisId ?? null}
    />
  );
}
