import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const malwareProvider = String(body.malwareProvider ?? "").trim();
  const aiProvider = String(body.aiProvider ?? "").trim();

  if (!username || !malwareProvider || !aiProvider) {
    return NextResponse.json({ error: "Preenche todos os campos." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilizador inválido" }, { status: 401 });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { username, malwareProvider, aiProvider },
    create: { userId: user.id, username, malwareProvider, aiProvider },
  });

  return NextResponse.json({ ok: true });
}
