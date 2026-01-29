import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

function encoder() {
  return new TextEncoder();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(ctx.params);

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Utilizador inválido" }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      status: true,
      emailTitle: true,
      emailSubject: true,
      emailBody: true,
      aiResponse: true,
    },
  });

  if (!analysis) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // replay se já existe resposta final
  if (analysis.status === "COMPLETED" && analysis.aiResponse) {
    const enc = encoder();
    const replay = analysis.aiResponse;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(replay));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  await prisma.analysis.update({
    where: { id: analysis.id },
    data: { status: "SCANNING", aiResponse: null },
  });

  const enc = encoder();

  // mock streaming
  const tokens = [
    `Análise do email "${analysis.emailTitle}".\n\n`,
    `Assunto: ${analysis.emailSubject}\n\n`,
    `Resumo: O conteúdo apresenta sinais típicos de engenharia social.\n`,
    `Pontos a verificar:\n- Remetente e domínio\n- Links e encurtadores\n- Urgência/ameaça\n\n`,
    `Medidas recomendadas:\n1) Não clicar em links\n2) Confirmar por canal alternativo\n3) Submeter anexos ao scanner escolhido\n\n`,
  ];

  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const t of tokens) {
          full += t;
          controller.enqueue(enc.encode(t));
          await new Promise((r) => setTimeout(r, 120));
        }

        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { status: "COMPLETED", aiResponse: full, completedAt: new Date() },
        });

        controller.close();
      } catch (e) {
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: { status: "FAILED" },
        });
        controller.error(e);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
