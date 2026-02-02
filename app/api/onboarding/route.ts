import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GroqModel } from "@prisma/client";

function isGroqModel(x: unknown): x is GroqModel {
  return typeof x === "string" && (Object.values(GroqModel) as string[]).includes(x);
}

function isMalwareProvider(x: unknown): x is "virustotal" | "metadefender" {
  return x === "virustotal" || x === "metadefender";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const username = String(body.username ?? "").trim();
  const malwareProvider = body.malwareProvider;
  const groqModel = body.groqModel;

  if (!username) return NextResponse.json({ error: "Username é obrigatório" }, { status: 400 });
  if (!isMalwareProvider(malwareProvider))
    return NextResponse.json({ error: "Malware provider inválido" }, { status: 400 });
  if (!isGroqModel(groqModel))
    return NextResponse.json({ error: "Modelo Groq inválido" }, { status: 400 });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { username, malwareProvider, groqModel },
    create: { userId: user.id, username, malwareProvider, groqModel },
  });

  return NextResponse.json({ ok: true });
}
